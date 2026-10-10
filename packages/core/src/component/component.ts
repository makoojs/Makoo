import type { AdapterMountParams, MountAdapter } from '../adapter/types';
import type { DOMObserver } from '../dom/observer';
import { MakooErrorCode } from '../error/ErrorCode';
import { injectionCleanupFailed, MakooError, stateSubscriberFailed } from '../error/MakooError';
import { type AttachListener, createAttachListener } from '../listener/attach';
import type { ListenerStatus } from '../listener/types';
import { createState } from '../state/createState';
import type { StateView } from '../state/types';
import {
	type ComponentExecutionControl,
	type ComponentMounter,
	createComponentExecution
} from './execution';
import type {
	ComponentCommand,
	ComponentInjection,
	ComponentStatus,
	ComponentStatusHandle,
	MakooComponentDeclaration
} from './types';

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
			execution: ComponentExecutionControl;
			cleanupCompletion: CleanupCompletion;
	  };

type Component = {
	readonly config: MakooComponentDeclaration;
	readonly dom: DOMObserver;
	readonly onRemoved: () => void;
	readonly isDisposed: () => boolean;
	readonly mounter: ComponentMounter;
	readonly state: ReturnType<typeof createState<ComponentStatus>>;
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
	onRemoved: () => void,
	isDisposed: () => boolean,
	globalListener: AdapterMountParams['globalListener']
): ComponentInjection {
	let component: Component;
	const attachedListenerNames = Object.freeze(
		(config.listeners ?? []).map((listener) => listener.name)
	);
	const command: ComponentCommand = Object.freeze({
		name: config.name,
		start: () => startComponent(component),
		stop: () => stopComponent(component),
		remove: () => removeComponent(component)
	});
	const statusHandle: ComponentStatusHandle = Object.freeze({
		getSnapshot: () => component.state.view.getSnapshot(),
		subscribe: (notify: () => void) => component.state.view.subscribe(notify),
		get lastError() {
			return component.lastError;
		},
		attachedListenerNames,
		attachedListener: (listenerName: string) => getAttachListenerStatus(component, listenerName)
	});
	component = {
		config,
		dom,
		onRemoved,
		isDisposed,
		mounter: {
			mount(container) {
				return adapter.mount({
					component: config.component,
					props: config.props,
					container,
					command,
					statusHandle,
					globalListener
				});
			},
			unmount(mountHandle) {
				adapter.unmount(mountHandle);
			}
		},
		state: createState<ComponentStatus>('idle', (cause) => {
			console.error(stateSubscriberFailed(`"${config.name}"`, cause));
		}),
		attachListeners: new Map(),
		intent: 'stopped',
		executionSlot: { kind: 'empty', cleanupPromise: Promise.resolve() },
		lastError: undefined
	};
	for (const attachListenerConfig of config.listeners ?? []) {
		component.attachListeners.set(
			attachListenerConfig.name,
			createAttachListener(
				{ ...attachListenerConfig, reinject: config.reinject },
				(error) => failComponent(component, attachListenerConfig.name, error),
				(cause) => {
					console.error(
						stateSubscriberFailed(
							`"${config.name}" listener "${attachListenerConfig.name}"`,
							cause
						)
					);
				}
			)
		);
	}
	return { kind: 'component', command, statusHandle };
}

function getAttachListenerStatus(component: Component, name: string): StateView<ListenerStatus> {
	const attachListener = component.attachListeners.get(name);
	if (!attachListener) {
		throw new MakooError(`Unknown listener "${name}" in "${component.config.name}"`, {
			code: MakooErrorCode.LISTENER_NOT_FOUND
		});
	}
	return attachListener.state.view;
}

function failComponent(component: Component, listenerName: string, error: MakooError): void {
	if (component.executionSlot.kind !== 'active') return;
	void endExecution(
		component,
		'failed',
		new MakooError(
			`"${component.config.name}" stopped because listener "${listenerName}" failed`,
			{ code: MakooErrorCode.ATTACHED_LISTENER_FAILED, cause: error }
		)
	).catch(() => {});
}

function startComponent(component: Component): void {
	const { config, executionSlot } = component;
	if (component.isDisposed()) {
		throw new MakooError('Core instance is disposed', {
			code: MakooErrorCode.INSTANCE_DISPOSED
		});
	}
	if (executionSlot.kind === 'cleanup-failed') {
		throw new MakooError(`Injection "${config.name}" cannot restart after cleanup failed`, {
			code: MakooErrorCode.INJECTION_CLOSED
		});
	}
	if (component.intent === 'removed') {
		throw new MakooError(`Injection "${config.name}" was removed`, {
			code: MakooErrorCode.INJECTION_REMOVED
		});
	}
	component.intent = 'running';
	if (executionSlot.kind !== 'empty') return;
	component.lastError = undefined;
	startExecution(component);
}

function startExecution(component: Component): void {
	let resolveCleanup!: () => void;
	let rejectCleanup!: (error: MakooError) => void;
	const cleanupPromise = new Promise<void>((resolve, reject) => {
		resolveCleanup = resolve;
		rejectCleanup = reject;
	});
	void cleanupPromise.catch(() => {});
	const execution = createComponentExecution(
		component.config,
		component.dom,
		component.mounter,
		component.attachListeners,
		// The execution only stops its own work; stale callbacks are filtered here.
		{
			setStatus(nextStatus) {
				const currentSlot = component.executionSlot;
				if (currentSlot.kind === 'active' && currentSlot.execution === execution) {
					component.state.set(nextStatus);
				}
			},
			ended(endReason, executionError) {
				const currentSlot = component.executionSlot;
				if (
					(currentSlot.kind === 'active' || currentSlot.kind === 'cancelling') &&
					currentSlot.execution === execution
				) {
					void endExecution(component, endReason, executionError).catch(() => {});
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

function stopComponent(component: Component): Promise<void> {
	const executionSlot = component.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	if (component.intent !== 'removed') component.intent = 'stopped';
	switch (executionSlot.kind) {
		case 'empty':
			component.state.set('idle');
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
			return endExecution(component, 'stopped');
	}
}

function removeComponent(component: Component): Promise<void> {
	const executionSlot = component.executionSlot;
	if (executionSlot.kind === 'cleanup-failed' || executionSlot.kind === 'removed') {
		return executionSlot.cleanupPromise;
	}
	component.intent = 'removed';
	const cleanupPromise = stopComponent(component);
	if (component.executionSlot.kind === 'empty') {
		component.executionSlot = { kind: 'removed', cleanupPromise };
		component.onRemoved();
	}
	return cleanupPromise;
}

async function endExecution(
	component: Component,
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
	if (cleanupErrors.length > 0) {
		const failure = injectionCleanupFailed(
			component.config.name,
			executionError ? [executionError, ...cleanupErrors] : cleanupErrors
		);
		component.lastError = failure;
		component.executionSlot = {
			kind: 'cleanup-failed',
			cleanupPromise: cleanupCompletion.promise
		};
		cleanupCompletion.reject(failure);
		console.error(failure);
		component.state.set('failed');
		throw failure;
	}

	component.executionSlot = { kind: 'empty', cleanupPromise: cleanupCompletion.promise };
	cleanupCompletion.resolve();
	if (component.intent === 'removed') {
		component.executionSlot = {
			kind: 'removed',
			cleanupPromise: cleanupCompletion.promise
		};
		component.state.set('idle');
		component.onRemoved();
		return;
	}
	if (
		component.intent === 'running' &&
		(endReason === 'stopped' || (endReason === 'detached' && component.config.reinject))
	) {
		if (endReason === 'detached') component.state.set('waiting');
		if (component.intent === 'running' && component.executionSlot.kind === 'empty') {
			if (endReason === 'stopped') startComponent(component);
			else startExecution(component);
		}
		return;
	}
	component.intent = 'stopped';
	if (executionError) {
		component.lastError = executionError;
		console.error(executionError);
	}
	component.state.set(endReason === 'stopped' ? 'idle' : 'failed');
}
