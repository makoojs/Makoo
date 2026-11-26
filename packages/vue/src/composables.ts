import type {
	ChildCommand,
	ChildInjection,
	ComponentCommand,
	ComponentInjection,
	ComponentStatus,
	ListenerInjection,
	ListenerStatus,
	MakooError,
	StateView
} from '@makoojs/core';
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
import { vueErrors } from './error';

export type VueComponentContext = {
	readonly injection: ComponentInjection | ChildInjection;
	readonly listener: (name: string) => ListenerInjection;
	/** Releases of subscriptions still held by this app; drained if mount fails. */
	readonly subscriptions: Set<() => void>;
};

export const componentContextKey: InjectionKey<VueComponentContext> = Symbol('makoo-component');

/**
 * The current component's command, plus reactive status refs.
 * Inside a Child Injection the command is a {@link ChildCommand}: `stop` only, no `start`/`remove`.
 */
export type VueMakooComponent = (ComponentCommand | ChildCommand) & {
	/** The error that ended the last execution; not reactive. */
	readonly lastError: MakooError | undefined;
	/** The component status. */
	readonly status: Readonly<Ref<ComponentStatus>>;
	/**
	 * Returns the status of an attached listener.
	 *
	 * @throws {@link MakooError} `MAKOO_VUE_LISTENER_NOT_FOUND` when the component has no listener with that name.
	 */
	attachedListener(name: string): Readonly<Ref<ListenerStatus>>;
	/**
	 * Looks up a standalone listener in the same Core Instance and tracks its status until the
	 * calling scope is disposed. Repeated calls for the same listener share one status ref.
	 *
	 * The commands are those of `core.listener(name)`; `status` is reactive, `lastError` (the
	 * latest execution or cleanup failure) is read live and is not reactive.
	 *
	 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no standalone listener has that name.
	 */
	listener(name: string): VueStandaloneListener;
};

type VueStandaloneListener = Pick<
	ListenerInjection,
	'lastError' | 'name' | 'remove' | 'start' | 'stop'
> & {
	/** The listener status. */
	readonly status: Readonly<Ref<ListenerStatus>>;
};

type StandaloneSubscription = {
	injection: ListenerInjection;
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
		throw vueErrors.createThrowable('MAKOO_VUE_HOOK_OUTSIDE_COMPONENT');
	}
	if (!getCurrentScope()) {
		throw vueErrors.createThrowable('MAKOO_VUE_HOOK_OUTSIDE_SCOPE');
	}
	const { command, statusHandle } = context.injection;
	const componentStatus = subscribeState(statusHandle, context.subscriptions);
	const attached: [string, Readonly<Ref<ListenerStatus>>][] =
		'attachedListener' in statusHandle
			? statusHandle.attachedListenerNames.map((name) => [
					name,
					subscribeState(statusHandle.attachedListener(name), context.subscriptions)
				])
			: [];
	const listeners = new Map(attached);
	const standaloneListeners = new Map<string, StandaloneSubscription>();
	onScopeDispose(() => {
		for (const entry of [...standaloneListeners.values()]) entry.release();
	});
	const controls: ComponentCommand | ChildCommand =
		'remove' in command
			? {
					name: command.name,
					start: command.start,
					stop: command.stop,
					remove: command.remove
				}
			: { name: command.name, stop: command.stop };
	return {
		...controls,
		status: componentStatus,
		get lastError() {
			return statusHandle.lastError;
		},
		attachedListener(name) {
			const listener = listeners.get(name);
			if (!listener)
				throw vueErrors.createThrowable('MAKOO_VUE_LISTENER_NOT_FOUND', {
					name,
					injection: command.name
				});
			return listener;
		},
		listener(name) {
			const found = context.listener(name);
			return {
				name: found.name,
				start: found.start,
				stop: found.stop,
				remove: found.remove,
				status: subscribeStandalone(
					name,
					found,
					standaloneListeners,
					context.subscriptions
				),
				get lastError() {
					return found.lastError;
				}
			};
		}
	};
}

function subscribeStandalone(
	name: string,
	injection: ListenerInjection,
	standaloneListeners: Map<string, StandaloneSubscription>,
	subscriptions: Set<() => void>
): Readonly<Ref<ListenerStatus>> {
	const current = standaloneListeners.get(name);
	if (current && current.injection === injection) return current.statusRef;

	let snapshotRef: Ref<ListenerStatus>;
	let statusRef: Readonly<Ref<ListenerStatus>>;
	if (current) {
		current.release();
		snapshotRef = current.snapshotRef;
		statusRef = current.statusRef;
		snapshotRef.value = injection.status;
	} else {
		snapshotRef = shallowRef(injection.status);
		statusRef = computed(() => snapshotRef.value);
	}

	let released = false;
	const unsubscribe = injection.subscribe(() => {
		if (!released) snapshotRef.value = injection.status;
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
	standaloneListeners.set(name, { injection, snapshotRef, statusRef, release });
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
