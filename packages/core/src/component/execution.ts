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
	readonly isCancelled: boolean;
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
	isCancelled: boolean;
	hasCleanupStarted: boolean;
	hasNotifiedEnd: boolean;
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
		isCancelled: false,
		hasCleanupStarted: false,
		hasNotifiedEnd: false,
		componentContainer: null,
		mountedComponent: null,
		cleanupErrors: []
	};
	return {
		get phase() {
			return execution.phase;
		},
		get isCancelled() {
			return execution.isCancelled;
		},
		start: () => awaitMountTarget(execution, dom, mounter, callbacks),
		cancel: () => cancelExecution(execution),
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
				notifyExecutionEnd(
					execution,
					callbacks.ended,
					'failed',
					new MakooError(
						`Timed out waiting for mount target "${config.name}"`,
						undefined,
						ErrorCode.DOM_WAIT_TIMEOUT
					).withContext({ injection: config.name, phase: 'wait', reason: 'timeout' })
				);
			},
			(cause) => {
				notifyExecutionEnd(
					execution,
					callbacks.ended,
					'failed',
					mountError(config.name, 'wait', cause)
				);
			}
		);
		if (
			execution.phase === 'pending' &&
			!execution.hasNotifiedEnd &&
			!execution.hasCleanupStarted &&
			!domWaitAbortController.signal.aborted
		) {
			callbacks.status('waiting');
		}
	} catch (cause) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'failed',
			mountError(config.name, 'mount', cause)
		);
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
	if (
		execution.hasCleanupStarted ||
		execution.hasNotifiedEnd ||
		domWaitAbortController.signal.aborted
	)
		return;
	if (!mountTarget.isConnected) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}

	watchElement(
		dom,
		mountTarget,
		domWaitAbortController.signal,
		() =>
			notifyExecutionEnd(
				execution,
				callbacks.ended,
				'detached',
				targetDetachedError(config.name)
			),
		() =>
			mountTarget.isConnected &&
			(!execution.componentContainer ||
				(execution.componentContainer.isConnected &&
					mountTarget.contains(execution.componentContainer)))
	);
	if (execution.hasCleanupStarted || domWaitAbortController.signal.aborted) return;
	const componentContainer = document.createElement('div');
	execution.componentContainer = componentContainer;
	mountTarget.append(componentContainer);
	if (domWaitAbortController.signal.aborted) {
		notifyExecutionEnd(execution, callbacks.ended, 'stopped');
		return;
	}

	execution.phase = 'mounting';
	callbacks.status('waiting');
	if (
		execution.isCancelled ||
		execution.hasCleanupStarted ||
		domWaitAbortController.signal.aborted
	) {
		notifyExecutionEnd(execution, callbacks.ended, 'stopped');
		return;
	}
	if (
		!mountTarget.isConnected ||
		!componentContainer.isConnected ||
		!mountTarget.contains(componentContainer)
	) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}

	try {
		const mountHandle = mounter.mount(componentContainer);
		execution.mountedComponent = { handle: mountHandle };
		execution.phase = 'mounted';
	} catch (cause) {
		if (cause instanceof MakooError) execution.cleanupErrors.push(...cause.cleanupErrors);
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'failed',
			mountError(config.name, 'mount', cause)
		);
		return;
	}

	if (execution.isCancelled || domWaitAbortController.signal.aborted) {
		notifyExecutionEnd(execution, callbacks.ended, 'stopped');
		return;
	}
	if (
		!mountTarget.isConnected ||
		!componentContainer.isConnected ||
		!mountTarget.contains(componentContainer)
	) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}
	for (const attachListener of execution.attachListeners.values()) {
		if (execution.hasCleanupStarted || execution.isCancelled) return;
		startListener(attachListener, dom);
		if (execution.hasCleanupStarted || execution.isCancelled) return;
		if (
			!mountTarget.isConnected ||
			!componentContainer.isConnected ||
			!mountTarget.contains(componentContainer)
		) {
			notifyExecutionEnd(
				execution,
				callbacks.ended,
				'detached',
				targetDetachedError(config.name)
			);
			return;
		}
	}
	if (!execution.hasCleanupStarted && !execution.isCancelled) callbacks.status('mounted');
}

function cancelExecution(execution: ComponentExecutionState): void {
	execution.isCancelled = true;
	execution.domWaitAbortController.abort();
}

async function cleanupExecution(
	execution: ComponentExecutionState,
	dom: DOMObserver,
	mounter: ComponentMounter
): Promise<MakooError[]> {
	const { config, cleanupErrors } = execution;
	if (execution.hasCleanupStarted) return cleanupErrors;
	execution.hasCleanupStarted = true;
	execution.phase = 'ended';

	try {
		execution.domWaitAbortController.abort();
	} catch (cause) {
		cleanupErrors.push(
			cleanupError(
				config.name,
				`Failed to cancel "${config.name}"`,
				ErrorCode.INJECTION_CLEANUP_FAILED,
				'cancel-failed',
				cause
			)
		);
	}

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

function notifyExecutionEnd(
	execution: ComponentExecutionState,
	onEnded: ExecutionCallbacks['ended'],
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): void {
	if (execution.hasNotifiedEnd || execution.hasCleanupStarted) return;
	execution.hasNotifiedEnd = true;
	onEnded(endReason, executionError);
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
