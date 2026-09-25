import type { DOMObserver } from '../dom/observer';
import { DEFAULT_DOM_TIMEOUT, waitForElement } from '../dom/waitForElement';
import { watchElement } from '../dom/watchElement';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { MakooListenerDeclaration } from './types';

export type ListenerExecution = {
	start(): void;
	finish(): MakooError[];
};

type ExecutionCallbacks = {
	status(status: 'waiting' | 'bound'): void;
	ended(reason: 'detached' | 'failed', error: MakooError): void;
	diagnostic(error: MakooError): void;
};

type ListenerExecutionState = {
	readonly config: MakooListenerDeclaration;
	/** One signal cancels discovery, target observation, and the native event binding. */
	readonly abortController: AbortController;
	readonly eventListener: EventListener;
	listenerTarget: Element | null;
	hasCleanupStarted: boolean;
	hasNotifiedEnd: boolean;
	readonly cleanupErrors: MakooError[];
};

export function createListenerExecution(
	config: MakooListenerDeclaration,
	dom: DOMObserver,
	callbacks: ExecutionCallbacks
): ListenerExecution {
	const execution: ListenerExecutionState = {
		config,
		abortController: new AbortController(),
		eventListener: (event) => invokeEventHandler(execution, callbacks.diagnostic, event),
		listenerTarget: null,
		hasCleanupStarted: false,
		hasNotifiedEnd: false,
		cleanupErrors: []
	};
	return {
		start: () => awaitListenerTarget(execution, dom, callbacks),
		finish: () => cleanupExecution(execution)
	};
}

function awaitListenerTarget(
	execution: ListenerExecutionState,
	dom: DOMObserver,
	callbacks: ExecutionCallbacks
): void {
	const { config, abortController } = execution;
	try {
		waitForElement(
			dom,
			config.listenAt,
			abortController.signal,
			config.timeout ?? DEFAULT_DOM_TIMEOUT,
			(listenerTarget) => bindListener(execution, dom, callbacks, listenerTarget),
			() => {
				notifyExecutionEnd(
					execution,
					callbacks.ended,
					'failed',
					new MakooError(
						`Timed out waiting for listener "${config.name}"`,
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
					bindingError(config.name, cause)
				);
			}
		);
		if (
			!execution.listenerTarget &&
			!execution.hasCleanupStarted &&
			!abortController.signal.aborted
		) {
			callbacks.status('waiting');
		}
	} catch (cause) {
		notifyExecutionEnd(execution, callbacks.ended, 'failed', bindingError(config.name, cause));
	}
}

function bindListener(
	execution: ListenerExecutionState,
	dom: DOMObserver,
	callbacks: ExecutionCallbacks,
	listenerTarget: Element
): void {
	const { config, abortController, eventListener } = execution;
	if (execution.hasCleanupStarted || abortController.signal.aborted) return;
	if (!listenerTarget.isConnected) {
		notifyExecutionEnd(
			execution,
			callbacks.ended,
			'detached',
			targetDetachedError(config.name)
		);
		return;
	}

	// Retain the target before binding so partial setup can still be cleaned up.
	execution.listenerTarget = listenerTarget;
	try {
		listenerTarget.addEventListener(config.type, eventListener, {
			capture: config.capture,
			signal: abortController.signal
		});
		watchElement(dom, listenerTarget, abortController.signal, () => {
			notifyExecutionEnd(
				execution,
				callbacks.ended,
				'detached',
				targetDetachedError(config.name)
			);
		});
	} catch (cause) {
		notifyExecutionEnd(execution, callbacks.ended, 'failed', bindingError(config.name, cause));
		return;
	}
	if (!execution.hasCleanupStarted && !abortController.signal.aborted) callbacks.status('bound');
}

function invokeEventHandler(
	execution: ListenerExecutionState,
	onDiagnostic: ExecutionCallbacks['diagnostic'],
	event: Event
): void {
	const { config, listenerTarget } = execution;
	if (execution.abortController.signal.aborted || !listenerTarget) return;
	try {
		const result = config.callback.call(listenerTarget, event);
		if (result !== undefined) {
			void Promise.resolve(result).catch((cause) => {
				notifyHandlerError(config.name, onDiagnostic, cause);
			});
		}
	} catch (cause) {
		notifyHandlerError(config.name, onDiagnostic, cause);
	}
}

function cleanupExecution(execution: ListenerExecutionState): MakooError[] {
	const { config, cleanupErrors, eventListener, listenerTarget } = execution;
	if (execution.hasCleanupStarted) return cleanupErrors;
	execution.hasCleanupStarted = true;
	execution.listenerTarget = null;

	// Invalidate queued callbacks and release observation before explicitly unbinding.
	try {
		execution.abortController.abort();
	} catch (cause) {
		cleanupErrors.push(unbindError(config.name, cause));
	}
	if (!listenerTarget) return cleanupErrors;
	try {
		listenerTarget.removeEventListener(config.type, eventListener, config.capture);
	} catch (cause) {
		cleanupErrors.push(unbindError(config.name, cause));
	}
	return cleanupErrors;
}

function notifyExecutionEnd(
	execution: ListenerExecutionState,
	onEnded: ExecutionCallbacks['ended'],
	endReason: 'detached' | 'failed',
	executionError: MakooError
): void {
	if (execution.hasNotifiedEnd || execution.hasCleanupStarted) return;
	execution.hasNotifiedEnd = true;
	onEnded(endReason, executionError);
}

function notifyHandlerError(
	featureName: string,
	onDiagnostic: ExecutionCallbacks['diagnostic'],
	cause: unknown
): void {
	onDiagnostic(
		new MakooError(
			`Event handler failed for "${featureName}"`,
			undefined,
			ErrorCode.LISTENER_HANDLER_FAILED,
			causeError(cause)
		).withContext({ feature: featureName, phase: 'event', reason: 'handler-failed' })
	);
}

function targetDetachedError(featureName: string): MakooError {
	return new MakooError(
		`Listener target "${featureName}" disconnected`,
		undefined,
		ErrorCode.LISTENER_TARGET_DETACHED
	).withContext({ feature: featureName, phase: 'watch', reason: 'target-detached' });
}

function bindingError(featureName: string, cause: unknown): MakooError {
	return new MakooError(
		`Failed to bind listener "${featureName}"`,
		undefined,
		ErrorCode.LISTENER_BIND_FAILED,
		causeError(cause)
	).withContext({ feature: featureName, phase: 'bind', reason: 'binding-failed' });
}

function unbindError(featureName: string, cause: unknown): MakooError {
	return new MakooError(
		`Failed to unbind listener "${featureName}"`,
		undefined,
		ErrorCode.LISTENER_UNBIND_FAIL,
		causeError(cause)
	).withContext({ feature: featureName, phase: 'cleanup', reason: 'unbind-failed' });
}

function causeError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause), { cause });
}
