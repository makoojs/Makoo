import type { DOMObserver } from '../dom/observer';
import { DEFAULT_DOM_TIMEOUT, waitForElement } from '../dom/waitForElement';
import { watchElement } from '../dom/watchElement';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { MakooListenerDeclaration } from './types';

export type ListenerExecution = {
	readonly config: MakooListenerDeclaration;
	phase: 'active' | 'cancelled' | 'cleaning' | 'settled';
	readonly abortController: AbortController;
	readonly eventListener: EventListener;
	listenerTarget: Element | null;
	readonly cleanupErrors: MakooError[];
};

type ExecutionCallbacks = {
	status(status: 'waiting' | 'bound'): void;
	ended(reason: 'detached' | 'failed', error: MakooError): void;
};

export function createListenerExecution(
	config: MakooListenerDeclaration,
	onDiagnostic: (error: MakooError) => void
): ListenerExecution {
	const execution: ListenerExecution = {
		config,
		phase: 'active',
		abortController: new AbortController(),
		eventListener: (event) => invokeEventHandler(execution, onDiagnostic, event),
		listenerTarget: null,
		cleanupErrors: []
	};
	return execution;
}

export function awaitListenerTarget(
	execution: ListenerExecution,
	dom: DOMObserver,
	callbacks: ExecutionCallbacks
): void {
	const { config } = execution;
	try {
		waitForElement(
			dom,
			config.listenAt,
			execution.abortController.signal,
			config.timeout ?? DEFAULT_DOM_TIMEOUT,
			(target) => bindListener(execution, dom, callbacks, target),
			() => {
				if (execution.phase !== 'active') return;
				callbacks.ended(
					'failed',
					new MakooError(
						`Timed out waiting for listener "${config.name}"`,
						undefined,
						ErrorCode.DOM_WAIT_TIMEOUT
					).withContext({ injection: config.name, phase: 'wait', reason: 'timeout' })
				);
			},
			(cause) => {
				if (execution.phase === 'active')
					callbacks.ended('failed', bindingError(config.name, cause));
			}
		);
		if (execution.phase === 'active' && !execution.listenerTarget) callbacks.status('waiting');
	} catch (cause) {
		if (execution.phase === 'active')
			callbacks.ended('failed', bindingError(config.name, cause));
	}
}

function bindListener(
	execution: ListenerExecution,
	dom: DOMObserver,
	callbacks: ExecutionCallbacks,
	listenerTarget: Element
): void {
	if (execution.phase !== 'active') return;
	const { config } = execution;
	if (!listenerTarget.isConnected) {
		callbacks.ended('detached', targetDetachedError(config.name));
		return;
	}
	// Retain the target before binding so partial setup can still be cleaned up.
	execution.listenerTarget = listenerTarget;
	try {
		listenerTarget.addEventListener(config.type, execution.eventListener, {
			capture: config.capture,
			signal: execution.abortController.signal
		});
		watchElement(dom, listenerTarget, execution.abortController.signal, () => {
			if (execution.phase === 'active')
				callbacks.ended('detached', targetDetachedError(config.name));
		});
	} catch (cause) {
		if (execution.phase === 'active')
			callbacks.ended('failed', bindingError(config.name, cause));
		return;
	}
	if (execution.phase === 'active') callbacks.status('bound');
}

export function cleanupExecution(execution: ListenerExecution): void {
	const { config, cleanupErrors, listenerTarget } = execution;
	execution.phase = 'cleaning';
	execution.listenerTarget = null;
	try {
		execution.abortController.abort();
	} catch (cause) {
		cleanupErrors.push(unbindError(config.name, cause));
	}
	if (listenerTarget) {
		try {
			listenerTarget.removeEventListener(
				config.type,
				execution.eventListener,
				config.capture
			);
		} catch (cause) {
			cleanupErrors.push(unbindError(config.name, cause));
		}
	}
	execution.phase = 'settled';
}

function invokeEventHandler(
	execution: ListenerExecution,
	onDiagnostic: (error: MakooError) => void,
	event: Event
): void {
	const { config, listenerTarget } = execution;
	if (execution.phase !== 'active' || !listenerTarget) return;
	try {
		const result = config.callback.call(listenerTarget, event);
		if (result !== undefined)
			void Promise.resolve(result).catch((cause) =>
				reportHandlerError(config.name, onDiagnostic, cause)
			);
	} catch (cause) {
		reportHandlerError(config.name, onDiagnostic, cause);
	}
}

function reportHandlerError(
	injectionName: string,
	onDiagnostic: (error: MakooError) => void,
	cause: unknown
): void {
	onDiagnostic(
		new MakooError(
			`Event handler failed for "${injectionName}"`,
			undefined,
			ErrorCode.LISTENER_HANDLER_FAILED,
			causeError(cause)
		).withContext({ injection: injectionName, phase: 'event', reason: 'handler-failed' })
	);
}

function targetDetachedError(injectionName: string): MakooError {
	return new MakooError(
		`Listener target "${injectionName}" disconnected`,
		undefined,
		ErrorCode.LISTENER_TARGET_DETACHED
	).withContext({ injection: injectionName, phase: 'watch', reason: 'target-detached' });
}

function bindingError(injectionName: string, cause: unknown): MakooError {
	return new MakooError(
		`Failed to bind listener "${injectionName}"`,
		undefined,
		ErrorCode.LISTENER_BIND_FAILED,
		causeError(cause)
	).withContext({ injection: injectionName, phase: 'bind', reason: 'binding-failed' });
}

function unbindError(injectionName: string, cause: unknown): MakooError {
	return new MakooError(
		`Failed to unbind listener "${injectionName}"`,
		undefined,
		ErrorCode.LISTENER_UNBIND_FAIL,
		causeError(cause)
	).withContext({ injection: injectionName, phase: 'cleanup', reason: 'unbind-failed' });
}

function causeError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause), { cause });
}
