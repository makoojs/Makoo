import type { DOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { createState } from '../state/createState';
import type { AttachListener } from './attach';
import {
	awaitListenerTarget,
	cleanupExecution,
	createListenerExecution,
	type ListenerExecution
} from './execution';
import type {
	ListenerCommand,
	ListenerInjection,
	ListenerStatus,
	ListenerStatusHandle,
	MakooListenerDeclaration
} from './types';

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

export type ListenerState = {
	readonly config: MakooListenerDeclaration;
	readonly state: ReturnType<typeof createState<ListenerStatus>>;
	lastError: MakooError | undefined;
};

export type Listener = ListenerState & {
	readonly kind: 'listener';
	intent: 'running' | 'stopped' | 'removed';
	executionSlot: ExecutionSlot | { kind: 'removed'; cleanupPromise: Promise<void> };
	readonly onRemoved: () => void;
	readonly isDisposed: () => boolean;
};

export function createListener(
	config: MakooListenerDeclaration,
	dom: DOMObserver,
	onRemoved: () => void,
	isDisposed: () => boolean
): ListenerInjection {
	const listener: Listener = {
		kind: 'listener',
		config,
		state: createState<ListenerStatus>('idle'),
		intent: 'stopped',
		executionSlot: { kind: 'empty', cleanupPromise: Promise.resolve() },
		lastError: undefined,
		onRemoved,
		isDisposed
	};
	const command: ListenerCommand = Object.freeze({
		name: config.name,
		start: () => startListener(listener, dom),
		stop: () => stopListener(listener, dom),
		remove: () => removeListener(listener, dom)
	});
	const status: ListenerStatusHandle = Object.freeze({
		getSnapshot: () => listener.state.view.getSnapshot(),
		subscribe: (notify: () => void) => listener.state.view.subscribe(notify),
		get lastError() {
			return listener.lastError;
		}
	});
	return { kind: 'listener', command, status };
}

export function startListener(listener: Listener | AttachListener, dom: DOMObserver): void {
	const { config, executionSlot } = listener;
	if (listener.kind === 'listener' && listener.isDisposed()) {
		throw new MakooError('Core instance is disposed', undefined, ErrorCode.INSTANCE_DISPOSED);
	}
	if (executionSlot.kind === 'cleanup-failed') {
		throw new MakooError(
			`Injection "${config.name}" cannot restart after cleanup failed`,
			undefined,
			ErrorCode.INJECTION_CLEANUP_FAILED
		).withContext({ injection: config.name, phase: 'cleanup', reason: 'cleanup-failed' });
	}
	if (listener.intent === 'removed') {
		throw new MakooError(
			`Injection "${config.name}" was removed`,
			undefined,
			ErrorCode.INJECTION_REMOVED
		);
	}
	listener.intent = 'running';
	if (executionSlot.kind !== 'empty') return;
	listener.lastError = undefined;
	startExecution(listener, dom);
}

function startExecution(listener: Listener | AttachListener, dom: DOMObserver): void {
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
		status(status) {
			const currentSlot = listener.executionSlot;
			if (currentSlot.kind === 'active' && currentSlot.execution === execution)
				listener.state.set(status);
		},
		ended(reason, error) {
			const currentSlot = listener.executionSlot;
			if (currentSlot.kind === 'active' && currentSlot.execution === execution)
				endExecution(listener, dom, reason, error);
		}
	});
}

function stopListener(listener: Listener, dom: DOMObserver): Promise<void> {
	const executionSlot = listener.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed')
		return executionSlot.cleanupPromise;
	if (listener.intent !== 'removed') listener.intent = 'stopped';
	switch (executionSlot.kind) {
		case 'empty':
			listener.state.set('idle');
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
		case 'active':
			return endExecution(listener, dom, 'stopped');
	}
}

function removeListener(listener: Listener, dom: DOMObserver): Promise<void> {
	const executionSlot = listener.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed')
		return executionSlot.cleanupPromise;
	listener.intent = 'removed';
	const cleanupPromise = stopListener(listener, dom);
	// Active executions unregister after cleanup; an empty listener can unregister now.
	if (listener.executionSlot.kind === 'empty') {
		listener.executionSlot = { kind: 'removed', cleanupPromise };
		listener.onRemoved();
	}
	return cleanupPromise;
}

export function endExecution(
	listener: Listener | AttachListener,
	dom: DOMObserver,
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): Promise<void> {
	const executionSlot = listener.executionSlot;
	switch (executionSlot.kind) {
		case 'empty':
		case 'removed':
		case 'cleanup-failed':
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
	}
	const { execution, cleanupCompletion } = executionSlot;
	listener.executionSlot = { ...executionSlot, kind: 'closing' };
	cleanupExecution(execution);
	const cleanupErrors = execution.cleanupErrors;
	const firstCleanupError = cleanupErrors[0];
	if (firstCleanupError) {
		const error = (executionError ?? firstCleanupError).withCleanupErrors(cleanupErrors);
		listener.lastError = error;
		if (listener.intent !== 'removed') listener.intent = 'stopped';
		listener.executionSlot = {
			kind: 'cleanup-failed',
			cleanupPromise: cleanupCompletion.promise,
			cleanupErrors
		};
		cleanupCompletion.reject(firstCleanupError);
		console.error(error);
		const completedSlot = listener.executionSlot;
		listener.state.set('failed');
		if (listener.kind === 'attach' && listener.executionSlot === completedSlot)
			listener.onFailed(error);
		return cleanupCompletion.promise;
	}

	// Commit the old result before subscribers or a new binding can reenter the controls.
	listener.executionSlot = { kind: 'empty', cleanupPromise: cleanupCompletion.promise };
	cleanupCompletion.resolve();
	if (listener.kind === 'listener' && listener.intent === 'removed') {
		listener.executionSlot = { kind: 'removed', cleanupPromise: cleanupCompletion.promise };
		listener.state.set('idle');
		listener.onRemoved();
		return cleanupCompletion.promise;
	}
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
	if (executionError && listener.kind === 'attach' && listener.executionSlot === completedSlot)
		listener.onFailed(executionError);
	return cleanupCompletion.promise;
}
