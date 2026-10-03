import type { DOMObserver } from '../dom/observer';
import { DEFAULT_DOM_TIMEOUT, waitForElement } from '../dom/waitForElement';
import { watchElement } from '../dom/watchElement';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { type AttachListener, stopAttachListeners } from '../listener/attach';
import { startListener } from '../listener/listener';

export type ComponentMounter = {
	mount(container: HTMLElement): unknown;
	unmount(handle: unknown): void;
};

type ComponentExecutionConfig = {
	readonly name: string;
	readonly injectAt: string;
	readonly timeout?: number;
};

export type ComponentExecution = {
	readonly phase: 'pending' | 'mounting' | 'mounted' | 'ended';
	start(): void;
	cancel(): void;
	finish(): Promise<MakooError[]>;
};

type ExecutionCallbacks = {
	status(status: 'waiting' | 'mounted'): void;
	ended(reason: 'stopped' | 'detached' | 'failed', error?: MakooError): void;
};

type ComponentExecutionState = {
	readonly config: ComponentExecutionConfig;
	readonly domWaitAbortController: AbortController;
	phase: ComponentExecution['phase'];
	componentContainer: HTMLElement | null;
	mountedComponent: { handle: unknown } | null;
	readonly cleanupErrors: MakooError[];
	readonly attachListeners: ReadonlyMap<string, AttachListener>;
};

export function createComponentExecution(
	config: ComponentExecutionConfig,
	dom: DOMObserver,
	mounter: ComponentMounter,
	attachListeners: ReadonlyMap<string, AttachListener>,
	callbacks: ExecutionCallbacks
): ComponentExecution {
	const execution: ComponentExecutionState = {
		config,
		attachListeners,
		domWaitAbortController: new AbortController(),
		phase: 'pending',
		componentContainer: null,
		mountedComponent: null,
		cleanupErrors: []
	};
	return {
		get phase() {
			return execution.phase;
		},
		start: () => awaitMountTarget(execution, dom, mounter, callbacks),
		cancel: () => execution.domWaitAbortController.abort(),
		finish: () => cleanupExecution(execution, dom, mounter)
	};
}

function awaitMountTarget(
	execution: ComponentExecutionState,
	dom: DOMObserver,
	mounter: ComponentMounter,
	callbacks: ExecutionCallbacks
): void {
	const { config, domWaitAbortController } = execution;
	try {
		waitForElement(
			dom,
			config.injectAt,
			domWaitAbortController.signal,
			config.timeout ?? DEFAULT_DOM_TIMEOUT,
			(mountTarget) => mountComponent(execution, dom, mounter, callbacks, mountTarget),
			() => {
				callbacks.ended(
					'failed',
					new MakooError(
						`Timed out waiting for mount target "${config.name}"`,
						undefined,
						ErrorCode.DOM_WAIT_TIMEOUT
					).withContext({ injection: config.name, phase: 'wait', reason: 'timeout' })
				);
			},
			(cause) => callbacks.ended('failed', mountError(config.name, 'wait', cause))
		);
		if (execution.phase === 'pending') callbacks.status('waiting');
	} catch (cause) {
		callbacks.ended('failed', mountError(config.name, 'mount', cause));
	}
}

function mountComponent(
	execution: ComponentExecutionState,
	dom: DOMObserver,
	mounter: ComponentMounter,
	callbacks: ExecutionCallbacks,
	mountTarget: Element
): void {
	const { config, domWaitAbortController } = execution;
	const { signal } = domWaitAbortController;
	watchElement(
		dom,
		mountTarget,
		signal,
		() => callbacks.ended('detached', targetDetachedError(config.name)),
		() =>
			mountTarget.isConnected &&
			(!execution.componentContainer ||
				(execution.componentContainer.isConnected &&
					mountTarget.contains(execution.componentContainer)))
	);
	const componentContainer = document.createElement('div');
	execution.componentContainer = componentContainer;
	mountTarget.append(componentContainer);

	// Only subscribers, the adapter, and child subscribers can stop this execution synchronously,
	// so cancellation is rechecked after each of them.
	execution.phase = 'mounting';
	callbacks.status('waiting');
	if (signal.aborted) {
		callbacks.ended('stopped');
		return;
	}
	if (
		!mountTarget.isConnected ||
		!componentContainer.isConnected ||
		!mountTarget.contains(componentContainer)
	) {
		callbacks.ended('detached', targetDetachedError(config.name));
		return;
	}

	try {
		const mountHandle = mounter.mount(componentContainer);
		execution.mountedComponent = { handle: mountHandle };
		execution.phase = 'mounted';
	} catch (cause) {
		if (cause instanceof MakooError) execution.cleanupErrors.push(...cause.cleanupErrors);
		callbacks.ended('failed', mountError(config.name, 'mount', cause));
		return;
	}

	if (signal.aborted) {
		callbacks.ended('stopped');
		return;
	}
	if (
		!mountTarget.isConnected ||
		!componentContainer.isConnected ||
		!mountTarget.contains(componentContainer)
	) {
		callbacks.ended('detached', targetDetachedError(config.name));
		return;
	}
	for (const attachListener of execution.attachListeners.values()) {
		startListener(attachListener, dom);
		if (signal.aborted) return;
		if (
			!mountTarget.isConnected ||
			!componentContainer.isConnected ||
			!mountTarget.contains(componentContainer)
		) {
			callbacks.ended('detached', targetDetachedError(config.name));
			return;
		}
	}
	callbacks.status('mounted');
}

async function cleanupExecution(
	execution: ComponentExecutionState,
	dom: DOMObserver,
	mounter: ComponentMounter
): Promise<MakooError[]> {
	execution.phase = 'ended';
	execution.domWaitAbortController.abort();
	const attachListenerErrors = await stopAttachListeners(execution.attachListeners, dom);
	collectAttachListenerErrors(execution, attachListenerErrors);
	return unmountComponent(execution, mounter);
}

function unmountComponent(
	execution: ComponentExecutionState,
	mounter: ComponentMounter
): MakooError[] {
	const { config, cleanupErrors } = execution;

	const mountedComponent = execution.mountedComponent;
	if (mountedComponent) {
		execution.mountedComponent = null;
		try {
			mounter.unmount(mountedComponent.handle);
		} catch (cause) {
			cleanupErrors.push(
				cleanupError(
					config.name,
					`Failed to unmount "${config.name}"`,
					ErrorCode.ADAPTER_UNMOUNT_FAIL,
					'unmount-failed',
					cause
				)
			);
		}
	}

	const componentContainer = execution.componentContainer;
	if (componentContainer) {
		execution.componentContainer = null;
		try {
			componentContainer.remove();
		} catch (cause) {
			cleanupErrors.push(
				cleanupError(
					config.name,
					`Failed to remove the container for "${config.name}"`,
					ErrorCode.COMPONENT_CONTAINER_REMOVE_FAIL,
					'container-remove-failed',
					cause
				)
			);
		}
	}
	return cleanupErrors;
}
function collectAttachListenerErrors(
	execution: ComponentExecutionState,
	errors: readonly MakooError[]
): void {
	for (const error of errors)
		execution.cleanupErrors.push(error.withContext({ injection: execution.config.name }));
}

function targetDetachedError(injectionName: string): MakooError {
	return new MakooError(
		`Mount target "${injectionName}" disconnected`,
		undefined,
		ErrorCode.COMPONENT_TARGET_DETACHED
	).withContext({ injection: injectionName, phase: 'mount', reason: 'target-detached' });
}

function mountError(injectionName: string, phase: 'wait' | 'mount', cause: unknown): MakooError {
	return new MakooError(
		`Failed to mount "${injectionName}"`,
		undefined,
		ErrorCode.ADAPTER_MOUNT_FAIL,
		causeError(cause)
	).withContext({ injection: injectionName, phase, reason: 'mount-failed' });
}

function cleanupError(
	injectionName: string,
	message: string,
	code: string,
	reason: string,
	cause: unknown
): MakooError {
	return new MakooError(message, undefined, code, causeError(cause)).withContext({
		injection: injectionName,
		phase: 'cleanup',
		reason
	});
}

function causeError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause), { cause });
}
