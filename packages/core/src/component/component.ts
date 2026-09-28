import type { MountAdapter } from '../adapter/types';
import type { DOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { type AttachListener, createAttachListener } from '../listener/attach';
import type { ListenerSnapshot } from '../listener/types';
import { createState } from '../state/createState';
import type { StateView } from '../state/types';
import { type ComponentExecution, createComponentExecution } from './execution';
import type { ComponentControl, ComponentSnapshot, MakooComponentDeclaration } from './types';

/** Deferred cleanup signal for one execution: awaiters share this promise. */
type CleanupCompletion = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: MakooError) => void;
};

/**
 * Slot for the current component execution (not the injection itself).
 *
 * Terminal kinds keep only `cleanupPromise` (already settled or reusable):
 * - empty: execution cleaned up; injection still registered and can start again
 * - removed: injection unregistered after cleanup (`onRemoved` ran)
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
			execution: ComponentExecution;
			cleanupCompletion: CleanupCompletion;
	  };

type Component = {
	readonly config: MakooComponentDeclaration;
	readonly state: ReturnType<typeof createState<ComponentSnapshot>>;
	readonly attachListeners: Map<string, AttachListener>;
	/** Desired lifecycle: running / stopped / permanently removed. */
	intent: 'running' | 'stopped' | 'removed';
	executionSlot: ExecutionSlot;
	lastError: MakooError | undefined;
};

export function createComponent(
	config: MakooComponentDeclaration,
	adapter: MountAdapter,
	dom: DOMObserver,
	onRemoved: () => void
): ComponentControl {
	const component: Component = {
		config,
		state: createState<ComponentSnapshot>({ status: 'idle' }),
		attachListeners: new Map(),
		intent: 'stopped',
		executionSlot: { kind: 'empty', cleanupPromise: Promise.resolve() },
		lastError: undefined
	};
	const control: ComponentControl = Object.freeze({
		name: config.name,
		state: component.state.view,
		get lastError() {
			return component.lastError;
		},
		listenerState: (listenerName: string) => getAttachListenerState(component, listenerName),
		start: () => startComponent(component, adapter, dom, control, onRemoved),
		stop: () => stopComponent(component, control, onRemoved),
		remove: () => removeComponent(component, control, onRemoved)
	});
	for (const attachListenerConfig of config.listeners ?? []) {
		component.attachListeners.set(
			attachListenerConfig.name,
			createAttachListener({ ...attachListenerConfig, reinject: config.reinject }, (error) =>
				failComponent(component, control, onRemoved, attachListenerConfig.name, error)
			)
		);
	}
	return control;
}

function getAttachListenerState(component: Component, name: string): StateView<ListenerSnapshot> {
	const attachListener = component.attachListeners.get(name);
	if (!attachListener) {
		throw new MakooError(
			`Unknown listener "${name}" in "${component.config.name}"`,
			undefined,
			ErrorCode.INJECTION_NOT_FOUND
		).withContext({ injection: component.config.name, listener: name });
	}
	return attachListener.state.view;
}

// TODO 这种类型的通知函数要减少或者优化
function failComponent(
	component: Component,
	control: ComponentControl,
	onRemoved: () => void,
	listenerName: string,
	error: MakooError
): void {
	if (component.executionSlot.kind !== 'active') return;
	void endExecution(
		component,
		control,
		onRemoved,
		'failed',
		error.withContext({ injection: component.config.name, listener: listenerName })
	).catch(() => {});
}

function startComponent(
	component: Component,
	adapter: MountAdapter,
	dom: DOMObserver,
	control: ComponentControl,
	onRemoved: () => void
): void {
	const { config, executionSlot } = component;
	if (executionSlot.kind === 'cleanup-failed') {
		throw new MakooError(
			`Injection "${config.name}" cannot restart after cleanup failed`,
			undefined,
			ErrorCode.INJECTION_CLEANUP_FAILED
		).withContext({ injection: config.name, phase: 'cleanup', reason: 'cleanup-failed' });
	}
	if (component.intent === 'removed') {
		throw new MakooError(
			`Injection "${config.name}" was removed`,
			undefined,
			ErrorCode.INJECTION_REMOVED
		);
	}
	component.intent = 'running';
	if (executionSlot.kind !== 'empty') return;

	component.lastError = undefined;
	let resolveCleanup!: () => void;
	let rejectCleanup!: (error: MakooError) => void;
	const cleanupPromise = new Promise<void>((resolve, reject) => {
		resolveCleanup = resolve;
		rejectCleanup = reject;
	});
	void cleanupPromise.catch(() => {});
	const execution = createComponentExecution(
		config,
		adapter,
		dom,
		control,
		component.attachListeners,
		{
			status(status) {
				const currentSlot = component.executionSlot;
				if (currentSlot.kind === 'active' && currentSlot.execution === execution) {
					component.state.set({ status });
				}
			},
			ended(endReason, executionError) {
				const currentSlot = component.executionSlot;
				if (
					(currentSlot.kind === 'active' || currentSlot.kind === 'cancelling') &&
					currentSlot.execution === execution
				) {
					void endExecution(
						component,
						control,
						onRemoved,
						endReason,
						executionError
					).catch(() => {});
				}
			}
		}
	);
	component.executionSlot = {
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

function stopComponent(
	component: Component,
	control: ComponentControl,
	onRemoved: () => void
): Promise<void> {
	const executionSlot = component.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	if (component.intent !== 'removed') component.intent = 'stopped';
	switch (executionSlot.kind) {
		case 'empty':
			component.state.set({ status: 'idle' });
			return executionSlot.cleanupPromise;
		case 'cancelling':
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
		case 'active':
			if (executionSlot.execution.phase === 'mounting') {
				component.executionSlot = { ...executionSlot, kind: 'cancelling' };
				executionSlot.execution.cancel();
				return executionSlot.cleanupCompletion.promise;
			}
			return endExecution(component, control, onRemoved, 'stopped');
	}
}

function removeComponent(
	component: Component,
	control: ComponentControl,
	onRemoved: () => void
): Promise<void> {
	const executionSlot = component.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	component.intent = 'removed';
	const cleanupPromise = stopComponent(component, control, onRemoved);
	if (component.executionSlot.kind === 'empty') {
		component.executionSlot = { kind: 'removed', cleanupPromise };
		onRemoved();
	}
	return cleanupPromise;
}

async function endExecution(
	component: Component,
	componentControl: ComponentControl,
	onRemoved: () => void,
	endReason: 'stopped' | 'detached' | 'failed',
	executionError?: MakooError
): Promise<void> {
	const executionSlot = component.executionSlot;
	switch (executionSlot.kind) {
		case 'empty':
		case 'removed':
		case 'cleanup-failed':
			return executionSlot.cleanupPromise;
		case 'closing':
			return executionSlot.cleanupCompletion.promise;
	}
	const { execution, cleanupCompletion } = executionSlot;
	component.executionSlot = { ...executionSlot, kind: 'closing' };
	const cleanupErrors = await execution.finish();
	const firstCleanupError = cleanupErrors[0];
	if (firstCleanupError) {
		component.lastError = (executionError ?? firstCleanupError).withCleanupErrors(
			cleanupErrors
		);
		if (component.intent !== 'removed') component.intent = 'stopped';
		component.executionSlot = {
			kind: 'cleanup-failed',
			cleanupPromise: cleanupCompletion.promise
		};
		cleanupCompletion.reject(firstCleanupError);
		console.error(component.lastError);
		component.state.set({ status: 'failed' });
		throw firstCleanupError;
	}

	component.executionSlot = { kind: 'empty', cleanupPromise: cleanupCompletion.promise };
	cleanupCompletion.resolve();
	if (component.intent === 'removed') {
		component.executionSlot = {
			kind: 'removed',
			cleanupPromise: cleanupCompletion.promise
		};
		component.state.set({ status: 'idle' });
		onRemoved();
		return;
	}
	if (
		component.intent === 'running' &&
		(endReason === 'stopped' || (endReason === 'detached' && component.config.reinject))
	) {
		if (endReason === 'detached') component.state.set({ status: 'waiting' });
		if (component.intent === 'running' && component.executionSlot.kind === 'empty') {
			componentControl.start();
		}
		return;
	}
	component.intent = 'stopped';
	if (executionError) {
		component.lastError = executionError;
		console.error(executionError);
	}
	component.state.set({ status: endReason === 'stopped' ? 'idle' : 'failed' });
}
