import type { ComponentAdapter } from '../adapter/types';
import type { DOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { createState } from '../state/createState';
import { createInjectionExecution, type InjectionExecution } from './execution';
import type { InjectionControl, InjectionSnapshot, MakooInjectionDeclaration } from './types';

/** Deferred cleanup signal for one execution: awaiters share this promise. */
type CleanupCompletion = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: MakooError) => void;
};

/**
 * Slot for the current injection execution (not the feature itself).
 *
 * Terminal kinds keep only `cleanupPromise` (already settled or reusable):
 * - empty: execution cleaned up; feature still registered and can start again
 * - removed: feature unregistered after cleanup (`onRemoved` ran)
 * - cleanup-failed: cleanup threw; restart is forbidden
 *
 * In-flight kinds keep `cleanupCompletion` (promise + resolve/reject):
 * - active: an execution is running normally
 * - cancelling: stop during `mounting`; wait for mount handle, then end via `ended`
 * - closing: `finish()` in progress; further stop/ended only await the same promise
 */
type ExecutionSlot =
	| { kind: 'empty' | 'removed' | 'cleanup-failed'; cleanupPromise: Promise<void> }
	| {
			kind: 'active' | 'cancelling' | 'closing';
			execution: InjectionExecution;
			cleanupCompletion: CleanupCompletion;
	  };

type InjectionFeature = {
	readonly config: MakooInjectionDeclaration;
	readonly state: ReturnType<typeof createState<InjectionSnapshot>>;
	/** Desired lifecycle: running / stopped / permanently removed. */
	intent: 'running' | 'stopped' | 'removed';
	executionSlot: ExecutionSlot;
	lastError: MakooError | undefined;
};

export function createInjection(
	config: MakooInjectionDeclaration,
	adapter: ComponentAdapter,
	dom: DOMObserver,
	onRemoved: () => void
): InjectionControl {
	const injectionFeature: InjectionFeature = {
		config,
		state: createState<InjectionSnapshot>({ status: 'idle' }),
		intent: 'stopped',
		executionSlot: { kind: 'empty', cleanupPromise: Promise.resolve() },
		lastError: undefined
	};
	const control: InjectionControl = Object.freeze({
		name: config.name,
		state: injectionFeature.state.view,
		get lastError() {
			return injectionFeature.lastError;
		},
		start: () => startInjection(injectionFeature, adapter, dom, control, onRemoved),
		stop: () => stopInjection(injectionFeature, control, onRemoved),
		remove: () => removeInjection(injectionFeature, control, onRemoved)
	});
	return control;
}

function startInjection(
	injectionFeature: InjectionFeature,
	adapter: ComponentAdapter,
	dom: DOMObserver,
	control: InjectionControl,
	onRemoved: () => void
): void {
	const { config, executionSlot } = injectionFeature;
	if (executionSlot.kind === 'cleanup-failed') {
		throw new MakooError(
			`Feature "${config.name}" cannot restart after cleanup failed`,
			undefined,
			ErrorCode.FEATURE_CLEANUP_FAILED
		).withContext({ feature: config.name, phase: 'cleanup', reason: 'cleanup-failed' });
	}
	if (injectionFeature.intent === 'removed') {
		throw new MakooError(
			`Feature "${config.name}" was removed`,
			undefined,
			ErrorCode.FEATURE_REMOVED
		);
	}
	// set the status to running
	injectionFeature.intent = 'running';
	if (executionSlot.kind !== 'empty') return;

	injectionFeature.lastError = undefined;
	let resolveCleanup!: () => void;
	let rejectCleanup!: (error: MakooError) => void;
	// Mark whether the cleanup for this round of injection is complete.
	const cleanupPromise = new Promise<void>((resolve, reject) => {
		resolveCleanup = resolve;
		rejectCleanup = reject;
	});
	// A background failure may finish this execution without a caller awaiting cleanup.
	void cleanupPromise.catch(() => {});
	const execution = createInjectionExecution(config, adapter, dom, control, {
		status(status) {
			const currentSlot = injectionFeature.executionSlot;
			// Determine if there is an execution round currently running.
			if (currentSlot.kind === 'active' && currentSlot.execution === execution) {
				// Change external status
				injectionFeature.state.set({ status });
			}
		},
		ended(endReason, executionError) {
			const currentSlot = injectionFeature.executionSlot;
			// active: normal end while still running; cancelling: stop during mount waiting to finish.
			if (
				(currentSlot.kind === 'active' || currentSlot.kind === 'cancelling') &&
				currentSlot.execution === execution
			) {
				endExecution(injectionFeature, control, onRemoved, endReason, executionError);
			}
		}
	});
	// init slot
	injectionFeature.executionSlot = {
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

function stopInjection(
	injectionFeature: InjectionFeature,
	control: InjectionControl,
	onRemoved: () => void
): Promise<void> {
	const executionSlot = injectionFeature.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	if (injectionFeature.intent !== 'removed') injectionFeature.intent = 'stopped';
	switch (executionSlot.kind) {
		case 'empty':
			injectionFeature.state.set({ status: 'idle' });
			return executionSlot.cleanupPromise;
		case 'cancelling':
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
		case 'active':
			if (executionSlot.execution.phase === 'mounting') {
				// Keep this execution until mount returns its handle, then clean it up.
				// Mark the slot kind as cancelling so we can track it.
				injectionFeature.executionSlot = { ...executionSlot, kind: 'cancelling' };
				executionSlot.execution.cancel();
				return executionSlot.cleanupCompletion.promise;
			}
			return endExecution(injectionFeature, control, onRemoved, 'stopped');
	}
}

function removeInjection(
	injectionFeature: InjectionFeature,
	control: InjectionControl,
	onRemoved: () => void
): Promise<void> {
	const executionSlot = injectionFeature.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	injectionFeature.intent = 'removed';
	const cleanupPromise = stopInjection(injectionFeature, control, onRemoved);
	// An active execution unregisters on completion; an empty one can unregister now.
	if (injectionFeature.executionSlot.kind === 'empty') {
		injectionFeature.executionSlot = { kind: 'removed', cleanupPromise };
		onRemoved();
	}
	return cleanupPromise;
}

function endExecution(
	injectionFeature: InjectionFeature,
	control: InjectionControl,
	onRemoved: () => void,
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): Promise<void> {
	const executionSlot = injectionFeature.executionSlot;
	switch (executionSlot.kind) {
		case 'empty':
		case 'removed':
		case 'cleanup-failed':
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
	}
	const { execution, cleanupCompletion } = executionSlot;
	injectionFeature.executionSlot = { ...executionSlot, kind: 'closing' };
	const cleanupErrors = execution.finish();
	const firstCleanupError = cleanupErrors[0];
	if (firstCleanupError) {
		injectionFeature.lastError = (executionError ?? firstCleanupError).withCleanupErrors(
			cleanupErrors
		);
		// If the cleanup fails, do not change "Delete" to "Just Stop".
		if (injectionFeature.intent !== 'removed') injectionFeature.intent = 'stopped';
		injectionFeature.executionSlot = {
			kind: 'cleanup-failed',
			cleanupPromise: cleanupCompletion.promise
		};
		cleanupCompletion.reject(firstCleanupError);
		console.error(injectionFeature.lastError);
		injectionFeature.state.set({ status: 'failed' });
		return cleanupCompletion.promise;
	}

	// Commit the old result before subscribers or the next mount can reenter control methods.
	injectionFeature.executionSlot = { kind: 'empty', cleanupPromise: cleanupCompletion.promise };
	cleanupCompletion.resolve();
	if (injectionFeature.intent === 'removed') {
		injectionFeature.executionSlot = {
			kind: 'removed',
			cleanupPromise: cleanupCompletion.promise
		};
		injectionFeature.state.set({ status: 'idle' });
		onRemoved();
		return cleanupCompletion.promise;
	}
	// Restart in case of re-injection
	// In this case, it is not stopped manually.
	if (endReason === 'stopped' && injectionFeature.intent === 'running') {
		control.start();
		return cleanupCompletion.promise;
	}
	injectionFeature.intent = 'stopped';
	if (executionError) {
		injectionFeature.lastError = executionError;
		console.error(executionError);
	}
	injectionFeature.state.set({ status: endReason === 'stopped' ? 'idle' : 'failed' });
	return cleanupCompletion.promise;
}
