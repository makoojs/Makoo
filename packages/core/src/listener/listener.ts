import type { DOMObserver } from '../dom/observer';
import { coreErrors } from '../error/coreErrors';
import type { MakooError } from '../error/MakooError';
import type { createState } from '../state/createState';
import type { AttachListener } from './attach';
import {
	awaitListenerTarget,
	cleanupExecution,
	createListenerExecution,
	type ListenerExecution
} from './execution';
import type { ListenerStatus, MakooListenerDeclaration } from './types';

type CleanupCompletion = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: MakooError) => void;
};

export type ExecutionSlot =
	| { kind: 'empty'; cleanupPromise: Promise<void> }
	| {
			kind: 'cleanup-failed';
			cleanupPromise: Promise<void>;
			cleanupErrors: readonly MakooError[];
	  }
	| {
			kind: 'active' | 'closing';
			execution: ListenerExecution;
			cleanupCompletion: CleanupCompletion;
	  };

export type HostListener = {
	readonly config: MakooListenerDeclaration;
	readonly state: ReturnType<typeof createState<ListenerStatus>>;
	lastError: MakooError | undefined;
};

export function startListener(listener: AttachListener, dom: DOMObserver): void {
	const { config, executionSlot } = listener;
	if (executionSlot.kind === 'cleanup-failed') {
		throw coreErrors.createThrowable('MAKOO_INJECTION_CLOSED', { name: config.name });
	}
	listener.intent = 'running';
	if (executionSlot.kind !== 'empty') return;
	listener.lastError = undefined;
	startExecution(listener, dom);
}

function startExecution(listener: AttachListener, dom: DOMObserver): void {
	let resolveCleanup!: () => void;
	let rejectCleanup!: (error: MakooError) => void;
	const cleanupPromise = new Promise<void>((resolve, reject) => {
		resolveCleanup = resolve;
		rejectCleanup = reject;
	});
	// A background failure may finish this execution without a caller awaiting cleanup.
	void cleanupPromise.catch(() => {});
	const execution = createListenerExecution(listener.config, (error) => {
		const currentSlot = listener.executionSlot;
		if (
			(currentSlot.kind === 'active' || currentSlot.kind === 'closing') &&
			currentSlot.execution === execution
		) {
			listener.lastError = error;
		}
		console.error(error);
	});
	listener.executionSlot = {
		kind: 'active',
		execution,
		cleanupCompletion: {
			promise: cleanupPromise,
			resolve: resolveCleanup,
			reject: rejectCleanup
		}
	};
	awaitListenerTarget(execution, dom, {
		setStatus(nextStatus) {
			const currentSlot = listener.executionSlot;
			if (currentSlot.kind === 'active' && currentSlot.execution === execution)
				listener.state.set(nextStatus);
		},
		ended(reason, error) {
			const currentSlot = listener.executionSlot;
			if (currentSlot.kind === 'active' && currentSlot.execution === execution)
				endExecution(listener, dom, reason, error);
		}
	});
}

export function endExecution(
	listener: AttachListener,
	dom: DOMObserver,
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): Promise<void> {
	const executionSlot = listener.executionSlot;
	switch (executionSlot.kind) {
		case 'empty':
		case 'cleanup-failed':
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
	}
	const { execution, cleanupCompletion } = executionSlot;
	listener.executionSlot = { ...executionSlot, kind: 'closing' };
	cleanupExecution(execution);
	const cleanupErrors = execution.cleanupErrors;
	if (cleanupErrors.length > 0) {
		if (executionError) listener.lastError = executionError;
		listener.executionSlot = {
			kind: 'cleanup-failed',
			cleanupPromise: cleanupCompletion.promise,
			cleanupErrors
		};
		cleanupCompletion.reject(executionError ?? cleanupErrors[0]);
		const completedSlot = listener.executionSlot;
		listener.state.set('failed');
		if (executionError && listener.executionSlot === completedSlot)
			listener.onFailed(executionError);
		return cleanupCompletion.promise;
	}

	// Commit the old result before subscribers or a new binding can reenter the controls.
	listener.executionSlot = { kind: 'empty', cleanupPromise: cleanupCompletion.promise };
	cleanupCompletion.resolve();
	if (
		listener.intent === 'running' &&
		(endReason === 'stopped' || (endReason === 'detached' && listener.config.reinject))
	) {
		if (endReason === 'detached') listener.state.set('waiting');
		if (listener.intent === 'running' && listener.executionSlot.kind === 'empty') {
			if (endReason === 'stopped') startListener(listener, dom);
			else startExecution(listener, dom);
		}
		return cleanupCompletion.promise;
	}
	listener.intent = 'stopped';
	if (executionError) {
		listener.lastError = executionError;
		console.error(executionError);
	}
	const completedSlot = listener.executionSlot;
	listener.state.set(endReason === 'stopped' ? 'idle' : 'failed');
	if (executionError && listener.executionSlot === completedSlot)
		listener.onFailed(executionError);
	return cleanupCompletion.promise;
}
