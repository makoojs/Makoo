import type { ComponentAdapter } from '../adapter/types';
import type { DOMObserver } from '../dom/observer';
import { DEFAULT_DOM_TIMEOUT, waitForElement } from '../dom/waitForElement';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { InjectionControl, MakooInjectionDeclaration } from './types';

export type InjectionExecution = {
	readonly phase: 'pending' | 'mounting' | 'mounted' | 'ended';
	readonly isCancelled: boolean;
	start(): void;
	cancel(): void;
	finish(): MakooError[];
};

type ExecutionCallbacks = {
	status(status: 'waiting' | 'mounted'): void;
	ended(reason: 'stopped' | 'detached' | 'failed', error?: MakooError): void;
};

type InjectionExecutionState = {
	readonly config: MakooInjectionDeclaration; // declaration for this execution round
	readonly domWaitAbortController: AbortController; // cancels waitForElement for the mount target
	phase: InjectionExecution['phase']; // pending → mounting → mounted → ended
	isCancelled: boolean; // stop requested (e.g. during mounting) before finish runs
	hasCleanupStarted: boolean; // finish() has begun; cleanup is idempotent after this
	hasNotifiedEnd: boolean; // ended callback already fired; report at most once
	componentContainer: HTMLElement | null; // host element created under the mount target
	mountedComponent: { handle: unknown } | null; // adapter mount ownership (even if handle is falsy)
	readonly cleanupErrors: MakooError[]; // errors collected while finishing / unmounting
};

export function createInjectionExecution(
	config: MakooInjectionDeclaration,
	adapter: ComponentAdapter,
	dom: DOMObserver,
	injection: InjectionControl,
	callbacks: ExecutionCallbacks
): InjectionExecution {
	const execution: InjectionExecutionState = {
		config,
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
		start: () => awaitMountTarget(execution, adapter, dom, injection, callbacks),
		cancel: () => cancelExecution(execution),
		finish: () => cleanupExecution(execution, adapter)
	};
}

function awaitMountTarget(
	execution: InjectionExecutionState,
	adapter: ComponentAdapter,
	dom: DOMObserver,
	injection: InjectionControl,
	callbacks: ExecutionCallbacks
): void {
	const { config, domWaitAbortController } = execution;
	try {
		waitForElement(
			dom,
			config.injectAt,
			domWaitAbortController.signal,
			config.timeout ?? DEFAULT_DOM_TIMEOUT,
			(mountTarget) => mountComponent(execution, adapter, injection, callbacks, mountTarget),
			() => {
				notifyExecutionEnd(
					execution,
					callbacks.ended,
					'failed',
					new MakooError(
						`Timed out waiting for mount target "${config.name}"`,
						undefined,
						ErrorCode.DOM_WAIT_TIMEOUT
					).withContext({ feature: config.name, phase: 'wait', reason: 'timeout' })
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
	execution: InjectionExecutionState,
	adapter: ComponentAdapter,
	injection: InjectionControl,
	callbacks: ExecutionCallbacks,
	mountTarget: Element
): void {
	const { config, domWaitAbortController } = execution;
	if (execution.hasCleanupStarted || execution.hasNotifiedEnd || domWaitAbortController.signal.aborted)
		return;
	// Determine if a node has been removed from the document.
	if (!mountTarget.isConnected) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}

	const componentContainer = document.createElement('div');
	execution.componentContainer = componentContainer;
	mountTarget.append(componentContainer);
	if (domWaitAbortController.signal.aborted) {
		notifyExecutionEnd(execution, callbacks.ended, 'stopped');
		return;
	}

	// Subscribers can stop this execution before the adapter is called.
	execution.phase = 'mounting';
	callbacks.status('waiting');
	if (execution.isCancelled || execution.hasCleanupStarted || domWaitAbortController.signal.aborted) {
		notifyExecutionEnd(execution, callbacks.ended, 'stopped');
		return;
	}
	if (!mountTarget.isConnected || !componentContainer.isConnected) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}

	try {
		const mountHandle = adapter.mount({
			component: config.component,
			props: config.props,
			container: componentContainer,
			injection
		});
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

	// A stop requested inside mount must wait until its handle has been recorded.
	if (execution.isCancelled || domWaitAbortController.signal.aborted) {
		notifyExecutionEnd(execution, callbacks.ended, 'stopped');
		return;
	}
	if (!mountTarget.isConnected || !componentContainer.isConnected) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}
	callbacks.status('mounted');
}

function cancelExecution(execution: InjectionExecutionState): void {
	execution.isCancelled = true;
	execution.domWaitAbortController.abort();
}

function cleanupExecution(
	execution: InjectionExecutionState,
	adapter: ComponentAdapter
): MakooError[] {
	const { config, cleanupErrors } = execution;
	if (execution.hasCleanupStarted) return cleanupErrors;
	execution.hasCleanupStarted = true;
	execution.phase = 'ended';

	// abort the dom finder
	try {
		execution.domWaitAbortController.abort();
	} catch (cause) {
		cleanupErrors.push(
			cleanupError(
				config.name,
				`Failed to cancel "${config.name}"`,
				ErrorCode.FEATURE_CLEANUP_FAILED,
				'cancel-failed',
				cause
			)
		);
	}

	// Release ownership before calling external code, which may reenter the controls.
	const mountedComponent = execution.mountedComponent;
	if (mountedComponent) {
		execution.mountedComponent = null;
		try {
			adapter.unmount(mountedComponent.handle);
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

	// Container removal is still attempted when unmount fails.
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
					ErrorCode.INJECTION_CONTAINER_REMOVE_FAIL,
					'container-remove-failed',
					cause
				)
			);
		}
	}
	return cleanupErrors;
}

function notifyExecutionEnd(
	execution: InjectionExecutionState,
	onEnded: ExecutionCallbacks['ended'],
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): void {
	if (execution.hasNotifiedEnd || execution.hasCleanupStarted) return;
	execution.hasNotifiedEnd = true;
	onEnded(endReason, executionError);
}

function targetDetachedError(featureName: string): MakooError {
	return new MakooError(
		`Mount target "${featureName}" disconnected`,
		undefined,
		ErrorCode.INJECTION_TARGET_DETACHED
	).withContext({ feature: featureName, phase: 'mount', reason: 'target-detached' });
}

function mountError(featureName: string, phase: 'wait' | 'mount', cause: unknown): MakooError {
	return new MakooError(
		`Failed to mount "${featureName}"`,
		undefined,
		ErrorCode.ADAPTER_MOUNT_FAIL,
		causeError(cause)
	).withContext({ feature: featureName, phase, reason: 'mount-failed' });
}

function cleanupError(
	featureName: string,
	message: string,
	code: string,
	reason: string,
	cause: unknown
): MakooError {
	return new MakooError(message, undefined, code, causeError(cause)).withContext({
		feature: featureName,
		phase: 'cleanup',
		reason
	});
}

function causeError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause), { cause });
}
