import type {
	AdapterMountParams,
	ComponentCommand,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerCommand,
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
	readonly command: ComponentCommand;
	readonly status: ComponentStatusHandle;
	readonly globalListener: AdapterMountParams['globalListener'];
	/** Releases of subscriptions still held by this app; drained if mount fails. */
	readonly subscriptions: Set<() => void>;
};

export const componentContextKey: InjectionKey<VueComponentContext> = Symbol('makoo-component');

export type VueMakooComponent = ComponentCommand & {
	readonly lastError: MakooError | undefined;
	readonly status: Readonly<Ref<ComponentStatus>>;
	attachedListener(name: string): Readonly<Ref<ListenerStatus>>;
	globalListener(name: string): VueStandaloneListener;
};

type VueStandaloneListener = ListenerCommand & {
	readonly lastError: MakooError | undefined;
	readonly status: Readonly<Ref<ListenerStatus>>;
};

type StandaloneSubscription = {
	status: ListenerStatusHandle;
	snapshot: Ref<ListenerStatus>;
	statusRef: Readonly<Ref<ListenerStatus>>;
	release: () => void;
};

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
	const { command, status } = context;
	const componentStatus = subscribeState(status, context.subscriptions);
	const listeners = new Map(
		status.attachedListenerNames.map((name) => [
			name,
			subscribeState(status.attachedListener(name), context.subscriptions)
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
			return status.lastError;
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
		globalListener(name) {
			const found = context.globalListener(name);
			return {
				name: found.command.name,
				start: found.command.start,
				stop: found.command.stop,
				remove: found.command.remove,
				status: subscribeStandalone(
					name,
					found.status,
					standaloneListeners,
					context.subscriptions
				),
				get lastError() {
					return found.status.lastError;
				}
			};
		}
	};
}

function subscribeStandalone(
	name: string,
	status: ListenerStatusHandle,
	standaloneListeners: Map<string, StandaloneSubscription>,
	subscriptions: Set<() => void>
): Readonly<Ref<ListenerStatus>> {
	const current = standaloneListeners.get(name);
	if (current && current.status === status) return current.statusRef;

	let snapshot: Ref<ListenerStatus>;
	let statusRef: Readonly<Ref<ListenerStatus>>;
	if (current) {
		current.release();
		snapshot = current.snapshot;
		statusRef = current.statusRef;
		snapshot.value = status.getSnapshot();
	} else {
		snapshot = shallowRef(status.getSnapshot());
		statusRef = computed(() => snapshot.value);
	}

	let released = false;
	const unsubscribe = status.subscribe(() => {
		if (!released) snapshot.value = status.getSnapshot();
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
	standaloneListeners.set(name, { status, snapshot, statusRef, release });
	return statusRef;
}

/** Tracks a StateView in a readonly ref; the subscription ends with the current scope. */
function subscribeState<T>(
	view: StateView<T>,
	subscriptions: Set<() => void>
): Readonly<Ref<Readonly<T>>> {
	const snapshot = shallowRef(view.getSnapshot());
	let released = false;
	const unsubscribe = view.subscribe(() => {
		if (!released) snapshot.value = view.getSnapshot();
	});
	const release = () => {
		if (released) return;
		released = true;
		subscriptions.delete(release);
		unsubscribe();
	};
	subscriptions.add(release);
	onScopeDispose(release);
	return computed(() => snapshot.value);
}
