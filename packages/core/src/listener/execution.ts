import type { DOMObserver } from '../dom/observer';
import { DEFAULT_DOM_TIMEOUT, waitForElement } from '../dom/waitForElement';
import { watchElement } from '../dom/watchElement';
import { MakooErrorCode } from '../error/ErrorCode';
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
					new MakooError(`Timed out waiting for "${config.name}"`, {
						code: MakooErrorCode.TARGET_WAIT_TIMEOUT
					})
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
		new MakooError(`Callback of listener "${injectionName}" failed`, {
			code: MakooErrorCode.LISTENER_CALLBACK_FAILED,
			cause
		})
	);
}

function targetDetachedError(name: string): MakooError {
	return new MakooError(`Listener target "${name}" disconnected`, {
		code: MakooErrorCode.LISTENER_TARGET_DETACHED
	});
}

function bindingError(name: string, cause: unknown): MakooError {
	return new MakooError(`Failed to bind listener "${name}"`, {
		code: MakooErrorCode.LISTENER_BIND_FAILED,
		cause
	});
}

function unbindError(name: string, cause: unknown): MakooError {
	return new MakooError(`Failed to unbind listener "${name}"`, {
		code: MakooErrorCode.LISTENER_UNBIND_FAILED,
		cause
	});
}
