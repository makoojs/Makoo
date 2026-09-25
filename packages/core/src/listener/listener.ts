import type { DOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { createState } from '../state/createState';
import { createListenerExecution, type ListenerExecution } from './execution';
import type { ListenerControl, ListenerSnapshot, MakooListenerDeclaration } from './types';

/** All cleanup requests for one execution share this completion. */
type CleanupCompletion = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: MakooError) => void;
};

type ExecutionSlot =
	| { kind: 'empty' | 'removed' | 'cleanup-failed'; cleanupPromise: Promise<void> }
	| {
			kind: 'active' | 'closing';
			execution: ListenerExecution;
			cleanupCompletion: CleanupCompletion;
	  };

type ListenerFeature = {
	readonly config: MakooListenerDeclaration;
	readonly state: ReturnType<typeof createState<ListenerSnapshot>>;
	intent: 'running' | 'stopped' | 'removed';
	executionSlot: ExecutionSlot;
	lastError: MakooError | undefined;
};

export function createListener(
	config: MakooListenerDeclaration,
	dom: DOMObserver,
	onRemoved: () => void
): ListenerControl {
	const listenerFeature: ListenerFeature = {
		config,
		state: createState<ListenerSnapshot>({ status: 'idle' }),
		intent: 'stopped',
		executionSlot: { kind: 'empty', cleanupPromise: Promise.resolve() },
		lastError: undefined
	};
	const control: ListenerControl = Object.freeze({
		name: config.name,
		state: listenerFeature.state.view,
		get lastError() {
			return listenerFeature.lastError;
		},
		start: () => startListener(listenerFeature, dom, control, onRemoved),
		stop: () => stopListener(listenerFeature, dom, control, onRemoved),
		remove: () => removeListener(listenerFeature, dom, control, onRemoved)
	});
	return control;
}

function startListener(
	listenerFeature: ListenerFeature,
	dom: DOMObserver,
	control: ListenerControl,
	onRemoved: () => void
): void {
	const { config, executionSlot } = listenerFeature;
	if (executionSlot.kind === 'cleanup-failed') {
		throw new MakooError(
			`Feature "${config.name}" cannot restart after cleanup failed`,
			undefined,
			ErrorCode.FEATURE_CLEANUP_FAILED
		).withContext({ feature: config.name, phase: 'cleanup', reason: 'cleanup-failed' });
	}
	if (listenerFeature.intent === 'removed') {
		throw new MakooError(
			`Feature "${config.name}" was removed`,
			undefined,
			ErrorCode.FEATURE_REMOVED
		);
	}
	listenerFeature.intent = 'running';
	if (executionSlot.kind !== 'empty') return;

	listenerFeature.lastError = undefined;
	startExecution(listenerFeature, dom, control, onRemoved);
}

function startExecution(
	listenerFeature: ListenerFeature,
	dom: DOMObserver,
	control: ListenerControl,
	onRemoved: () => void
): void {
	let resolveCleanup!: () => void;
	let rejectCleanup!: (error: MakooError) => void;
	const cleanupPromise = new Promise<void>((resolve, reject) => {
		resolveCleanup = resolve;
		rejectCleanup = reject;
	});
	// Background failures can end an execution without a caller awaiting cleanup.
	void cleanupPromise.catch(() => {});
	const execution = createListenerExecution(listenerFeature.config, dom, {
		status(status) {
			const currentSlot = listenerFeature.executionSlot;
			if (currentSlot.kind === 'active' && currentSlot.execution === execution) {
				listenerFeature.state.set({ status });
			}
		},
		ended(endReason, executionError) {
			const currentSlot = listenerFeature.executionSlot;
			if (currentSlot.kind === 'active' && currentSlot.execution === execution) {
				endExecution(listenerFeature, dom, control, onRemoved, endReason, executionError);
			}
		},
		diagnostic(error) {
			const currentSlot = listenerFeature.executionSlot;
			if (
				(currentSlot.kind === 'active' || currentSlot.kind === 'closing') &&
				currentSlot.execution === execution
			) {
				listenerFeature.lastError = error;
			}
			// Late business failures are reported without overwriting another execution's diagnostic.
			console.error(error);
		}
	});
	listenerFeature.executionSlot = {
		kind: 'active',
		execution,
		cleanupCompletion: {
			promise: cleanupPromise,
			resolve: resolveCleanup,
			reject: rejectCleanup
		}
	};
	execution.start();
}

function stopListener(
	listenerFeature: ListenerFeature,
	dom: DOMObserver,
	control: ListenerControl,
	onRemoved: () => void
): Promise<void> {
	const executionSlot = listenerFeature.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	if (listenerFeature.intent !== 'removed') listenerFeature.intent = 'stopped';
	switch (executionSlot.kind) {
		case 'empty':
			listenerFeature.state.set({ status: 'idle' });
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
		case 'active':
			return endExecution(listenerFeature, dom, control, onRemoved, 'stopped');
	}
}

function removeListener(
	listenerFeature: ListenerFeature,
	dom: DOMObserver,
	control: ListenerControl,
	onRemoved: () => void
): Promise<void> {
	const executionSlot = listenerFeature.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	listenerFeature.intent = 'removed';
	const cleanupPromise = stopListener(listenerFeature, dom, control, onRemoved);
	// Active executions unregister after cleanup; an empty feature can unregister now.
	if (listenerFeature.executionSlot.kind === 'empty') {
		listenerFeature.executionSlot = { kind: 'removed', cleanupPromise };
		onRemoved();
	}
	return cleanupPromise;
}

function endExecution(
	listenerFeature: ListenerFeature,
	dom: DOMObserver,
	control: ListenerControl,
	onRemoved: () => void,
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): Promise<void> {
	const executionSlot = listenerFeature.executionSlot;
	switch (executionSlot.kind) {
		case 'empty':
		case 'removed':
		case 'cleanup-failed':
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
	}
	const { execution, cleanupCompletion } = executionSlot;
	listenerFeature.executionSlot = { ...executionSlot, kind: 'closing' };
	const cleanupErrors = execution.finish();
	const firstCleanupError = cleanupErrors[0];
	if (firstCleanupError) {
		listenerFeature.lastError = (executionError ?? firstCleanupError).withCleanupErrors(
			cleanupErrors
		);
		if (listenerFeature.intent !== 'removed') listenerFeature.intent = 'stopped';
		listenerFeature.executionSlot = {
			kind: 'cleanup-failed',
			cleanupPromise: cleanupCompletion.promise
		};
		cleanupCompletion.reject(firstCleanupError);
		console.error(listenerFeature.lastError);
		listenerFeature.state.set({ status: 'failed' });
		return cleanupCompletion.promise;
	}

	// Settle the old execution before subscribers or a new binding can reenter the controls.
	listenerFeature.executionSlot = { kind: 'empty', cleanupPromise: cleanupCompletion.promise };
	cleanupCompletion.resolve();
	if (listenerFeature.intent === 'removed') {
		listenerFeature.executionSlot = {
			kind: 'removed',
			cleanupPromise: cleanupCompletion.promise
		};
		listenerFeature.state.set({ status: 'idle' });
		onRemoved();
		return cleanupCompletion.promise;
	}
	if (endReason === 'stopped' && listenerFeature.intent === 'running') {
		control.start();
		return cleanupCompletion.promise;
	}
	if (
		endReason === 'detached' &&
		listenerFeature.config.reinject &&
		listenerFeature.intent === 'running'
	) {
		listenerFeature.state.set({ status: 'waiting' });
		// A subscriber may stop, remove, or explicitly restart during this notification.
		if (
			listenerFeature.intent === 'running' &&
			listenerFeature.executionSlot.kind === 'empty'
		) {
			startExecution(listenerFeature, dom, control, onRemoved);
		}
		return cleanupCompletion.promise;
	}

	listenerFeature.intent = 'stopped';
	if (executionError) {
		listenerFeature.lastError = executionError;
		console.error(executionError);
	}
	listenerFeature.state.set({ status: endReason === 'stopped' ? 'idle' : 'failed' });
	return cleanupCompletion.promise;
}
