import type { DOMObserver } from '../dom/observer';
import { DEFAULT_DOM_TIMEOUT, waitForElement } from '../dom/waitForElement';
import { watchElement } from '../dom/watchElement';
import { MakooErrorCode } from '../error/ErrorCode';
import { MakooAggregateError, MakooError } from '../error/MakooError';
import { type AttachListener, stopAttachListeners } from '../listener/attach';
import { startListener } from '../listener/listener';

export type ComponentMounter = {
	mount(container: HTMLElement): unknown;
	unmount(mountHandle: unknown): void;
};

type ComponentExecutionConfig = {
	readonly name: string;
	readonly injectAt: string;
	readonly timeout?: number;
};

export type ComponentExecutionControl = {
	readonly phase: 'pending' | 'mounting' | 'mounted' | 'ended';
	start(): void;
	cancel(): void;
	finish(): Promise<unknown[]>;
};

type ExecutionCallbacks = {
	setStatus(nextStatus: 'waiting' | 'mounted'): void;
	ended(reason: 'stopped' | 'detached' | 'failed', error?: MakooError): void;
};

type ComponentExecution = {
	readonly name: string;
	readonly domWaitAbortController: AbortController;
	phase: ComponentExecutionControl['phase'];
	componentContainer: HTMLElement | null;
	mountedComponent: { mountHandle: unknown } | null;
	readonly cleanupErrors: unknown[];
	readonly attachListeners: ReadonlyMap<string, AttachListener>;
};

export function createComponentExecution(
	config: ComponentExecutionConfig,
	dom: DOMObserver,
	mounter: ComponentMounter,
	attachListeners: ReadonlyMap<string, AttachListener>,
	callbacks: ExecutionCallbacks
): ComponentExecutionControl {
	const execution = createExecutionState(config.name, attachListeners);
	return {
		get phase() {
			return execution.phase;
		},
		start: () => awaitMountTarget(execution, config, dom, mounter, callbacks),
		cancel: () => execution.domWaitAbortController.abort(),
		finish: () => cleanupExecution(execution, dom, mounter)
	};
}

/**
 * Mounts into an already-known Mount Target: shared lifetime for single inject after wait
 * and for Each Child mounts that skip wait-for-first-match.
 */
export function createChildExecution(
	name: string,
	mountTarget: Element,
	dom: DOMObserver,
	mounter: ComponentMounter,
	attachListeners: ReadonlyMap<string, AttachListener>,
	callbacks: ExecutionCallbacks
): ComponentExecutionControl {
	const execution = createExecutionState(name, attachListeners);
	return {
		get phase() {
			return execution.phase;
		},
		start: () => {
			try {
				mountComponent(execution, mountTarget, dom, mounter, callbacks);
			} catch (cause) {
				callbacks.ended('failed', mountFailed(execution, cause));
			}
		},
		cancel: () => execution.domWaitAbortController.abort(),
		finish: () => cleanupExecution(execution, dom, mounter)
	};
}

function createExecutionState(
	name: string,
	attachListeners: ReadonlyMap<string, AttachListener>
): ComponentExecution {
	return {
		name,
		attachListeners,
		domWaitAbortController: new AbortController(),
		phase: 'pending',
		componentContainer: null,
		mountedComponent: null,
		cleanupErrors: []
	};
}

function awaitMountTarget(
	execution: ComponentExecution,
	config: ComponentExecutionConfig,
	dom: DOMObserver,
	mounter: ComponentMounter,
	callbacks: ExecutionCallbacks
): void {
	const { domWaitAbortController } = execution;
	try {
		waitForElement(
			dom,
			config.injectAt,
			domWaitAbortController.signal,
			config.timeout ?? DEFAULT_DOM_TIMEOUT,
			(mountTarget) => mountComponent(execution, mountTarget, dom, mounter, callbacks),
			() => {
				callbacks.ended('failed', waitTimedOut(config.name));
			},
			(cause) => callbacks.ended('failed', mountFailed(execution, cause))
		);
		if (execution.phase === 'pending') callbacks.setStatus('waiting');
	} catch (cause) {
		callbacks.ended('failed', mountFailed(execution, cause));
	}
}

function mountComponent(
	execution: ComponentExecution,
	mountTarget: Element,
	dom: DOMObserver,
	mounter: ComponentMounter,
	callbacks: ExecutionCallbacks
): void {
	const { name, domWaitAbortController } = execution;
	const { signal } = domWaitAbortController;
	watchElement(
		dom,
		mountTarget,
		signal,
		() => callbacks.ended('detached', targetDetachedError(name)),
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
	callbacks.setStatus('waiting');
	if (signal.aborted) {
		callbacks.ended('stopped');
		return;
	}
	if (
		!mountTarget.isConnected ||
		!componentContainer.isConnected ||
		!mountTarget.contains(componentContainer)
	) {
		callbacks.ended('detached', targetDetachedError(name));
		return;
	}

	try {
		const mountHandle = mounter.mount(componentContainer);
		execution.mountedComponent = { mountHandle };
		execution.phase = 'mounted';
	} catch (cause) {
		callbacks.ended('failed', mountFailed(execution, cause));
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
		callbacks.ended('detached', targetDetachedError(name));
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
			callbacks.ended('detached', targetDetachedError(name));
			return;
		}
	}
	callbacks.setStatus('mounted');
}

async function cleanupExecution(
	execution: ComponentExecution,
	dom: DOMObserver,
	mounter: ComponentMounter
): Promise<unknown[]> {
	execution.phase = 'ended';
	execution.domWaitAbortController.abort();
	const attachListenerErrors = await stopAttachListeners(execution.attachListeners, dom);
	execution.cleanupErrors.push(...attachListenerErrors);
	return unmountComponent(execution, mounter);
}

function unmountComponent(execution: ComponentExecution, mounter: ComponentMounter): unknown[] {
	const { name, cleanupErrors } = execution;

	const mountedComponent = execution.mountedComponent;
	if (mountedComponent) {
		execution.mountedComponent = null;
		try {
			mounter.unmount(mountedComponent.mountHandle);
		} catch (cause) {
			cleanupErrors.push(
				new MakooError(`Failed to unmount "${name}"`, {
					code: MakooErrorCode.UNMOUNT_FAILED,
					cause
				})
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
				new MakooError(`Failed to remove container of "${name}"`, {
					code: MakooErrorCode.CONTAINER_REMOVE_FAILED,
					cause
				})
			);
		}
	}
	return cleanupErrors;
}
function waitTimedOut(name: string): MakooError {
	return new MakooError(`Timed out waiting for the mount target of "${name}"`, {
		code: MakooErrorCode.TARGET_WAIT_TIMEOUT
	});
}

function targetDetachedError(name: string): MakooError {
	return new MakooError(`Mount target "${name}" disconnected`, {
		code: MakooErrorCode.MOUNT_TARGET_DETACHED
	});
}

function mountFailed(execution: ComponentExecution, cause: unknown): MakooError {
	const adapterCleanup =
		cause instanceof MakooAggregateError && cause.code === MakooErrorCode.MOUNT_CLEANUP_FAILED
			? cause
			: undefined;
	if (adapterCleanup) execution.cleanupErrors.push(...adapterCleanup.errors);
	return new MakooError(`Failed to mount "${execution.name}"`, {
		code: MakooErrorCode.MOUNT_FAILED,
		cause: adapterCleanup ? adapterCleanup.cause : cause
	});
}
