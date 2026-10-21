import type {
	ComponentCommand,
	ComponentInjection,
	ComponentStatus,
	ListenerCommand,
	ListenerInjection,
	ListenerStatus,
	ListenerStatusHandle,
	StateView
} from '@makoojs/core';
import { MakooError, MakooErrorCode } from '@makoojs/core';
import {
	computed,
	getCurrentScope,
	hasInjectionContext,
	type InjectionKey,
	inject,
	onScopeDispose,
	type Ref,
	shallowRef
} from 'vue';
import { VueErrorCode } from './error';

export type VueComponentContext = {
	readonly injection: ComponentInjection;
	readonly listener: (name: string) => ListenerInjection;
	/** Releases of subscriptions still held by this app; drained if mount fails. */
	readonly subscriptions: Set<() => void>;
};

export const componentContextKey: InjectionKey<VueComponentContext> = Symbol('makoo-component');

/** The current component's command, plus reactive status refs. */
export type VueMakooComponent = ComponentCommand & {
	/** The error that ended the last execution; not reactive. */
	readonly lastError: MakooError | undefined;
	/** The component status. */
	readonly status: Readonly<Ref<ComponentStatus>>;
	/**
	 * Returns the status of an attached listener.
	 *
	 * @throws {@link MakooError} `LISTENER_NOT_FOUND` when the component has no listener with that name.
	 */
	attachedListener(name: string): Readonly<Ref<ListenerStatus>>;
	/**
	 * Looks up a standalone listener in the same Core Instance and tracks its status until the
	 * calling scope is disposed. Repeated calls for the same listener share one status ref.
	 *
	 * Flat command methods and a reactive `status` wrap the same bag as `core.listener(name)`.
	 *
	 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no top-level injection has that name.
	 */
	listener(name: string): VueStandaloneListener;
};

type VueStandaloneListener = ListenerCommand & {
	/** The latest execution failure, cleanup failure, or event handler error; not reactive. */
	readonly lastError: MakooError | undefined;
	/** The listener status. */
	readonly status: Readonly<Ref<ListenerStatus>>;
};

type StandaloneSubscription = {
	statusHandle: ListenerStatusHandle;
	snapshotRef: Ref<ListenerStatus>;
	statusRef: Readonly<Ref<ListenerStatus>>;
	release: () => void;
};

/**
 * Returns the controls and status of the Makoo component this Vue component belongs to.
 * Subscriptions end when the calling scope is disposed.
 *
 * @throws {@link MakooError} `VUE_HOOK_OUTSIDE_COMPONENT` when there is no injection context from
 * an app mounted by the Vue adapter, such as in an event handler or timer, or
 * `VUE_HOOK_OUTSIDE_SCOPE` when that context exists but there is no active effect scope.
 */
export function useMakooComponent(): VueMakooComponent {
	const context = hasInjectionContext() ? inject(componentContextKey, null) : null;
	if (!context) {
		throw new MakooError(
			'useMakooComponent() must be called inside a component mounted by the Makoo Vue adapter',
			{ code: VueErrorCode.VUE_HOOK_OUTSIDE_COMPONENT }
		);
	}
	if (!getCurrentScope()) {
		throw new MakooError(
			'useMakooComponent() must be called inside a component setup or effect scope',
			{ code: VueErrorCode.VUE_HOOK_OUTSIDE_SCOPE }
		);
	}
	const { command, statusHandle } = context.injection;
	const componentStatus = subscribeState(statusHandle, context.subscriptions);
	const listeners = new Map(
		statusHandle.attachedListenerNames.map((name) => [
			name,
			subscribeState(statusHandle.attachedListener(name), context.subscriptions)
		])
	);
	const standaloneListeners = new Map<string, StandaloneSubscription>();
	onScopeDispose(() => {
		for (const entry of [...standaloneListeners.values()]) entry.release();
	});
	return {
		name: command.name,
		status: componentStatus,
		get lastError() {
			return statusHandle.lastError;
		},
		start: command.start,
		stop: command.stop,
		remove: command.remove,
		attachedListener(name) {
			const listener = listeners.get(name);
			if (!listener)
				throw new MakooError(`Unknown listener "${name}" in "${command.name}"`, {
					code: MakooErrorCode.LISTENER_NOT_FOUND
				});
			return listener;
		},
		listener(name) {
			const found = context.listener(name);
			return {
				name: found.command.name,
				start: found.command.start,
				stop: found.command.stop,
				remove: found.command.remove,
				status: subscribeStandalone(
					name,
					found.statusHandle,
					standaloneListeners,
					context.subscriptions
				),
				get lastError() {
					return found.statusHandle.lastError;
				}
			};
		}
	};
}

function subscribeStandalone(
	name: string,
	statusHandle: ListenerStatusHandle,
	standaloneListeners: Map<string, StandaloneSubscription>,
	subscriptions: Set<() => void>
): Readonly<Ref<ListenerStatus>> {
	const current = standaloneListeners.get(name);
	if (current && current.statusHandle === statusHandle) return current.statusRef;

	let snapshotRef: Ref<ListenerStatus>;
	let statusRef: Readonly<Ref<ListenerStatus>>;
	if (current) {
		current.release();
		snapshotRef = current.snapshotRef;
		statusRef = current.statusRef;
		snapshotRef.value = statusHandle.getSnapshot();
	} else {
		snapshotRef = shallowRef(statusHandle.getSnapshot());
		statusRef = computed(() => snapshotRef.value);
	}

	let released = false;
	const unsubscribe = statusHandle.subscribe(() => {
		if (!released) snapshotRef.value = statusHandle.getSnapshot();
	});
	const release = () => {
		if (released) return;
		released = true;
		// delete from subscriptions and standaloneListeners
		subscriptions.delete(release);
		unsubscribe();
		const active = standaloneListeners.get(name);
		if (active && active.release === release) standaloneListeners.delete(name);
	};
	subscriptions.add(release);
	standaloneListeners.set(name, { statusHandle, snapshotRef, statusRef, release });
	return statusRef;
}

/** Tracks a StateView in a readonly ref; the subscription ends with the current scope. */
function subscribeState<T>(
	view: StateView<T>,
	subscriptions: Set<() => void>
): Readonly<Ref<Readonly<T>>> {
	const snapshotRef = shallowRef(view.getSnapshot());
	let released = false;
	const unsubscribe = view.subscribe(() => {
		if (!released) snapshotRef.value = view.getSnapshot();
	});
	const release = () => {
		if (released) return;
		released = true;
		subscriptions.delete(release);
		unsubscribe();
	};
	subscriptions.add(release);
	onScopeDispose(release);
	return computed(() => snapshotRef.value);
}
