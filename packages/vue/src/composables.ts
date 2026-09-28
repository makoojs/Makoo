import type {
	ComponentControl,
	ComponentSnapshot,
	ListenerSnapshot,
	StateView
} from '@makoojs/core';
import { ErrorCode, MakooError } from '@makoojs/core';
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

export type VueComponentContext = {
	readonly control: ComponentControl;
	readonly listenerNames: readonly string[];
	/** Releases of subscriptions still held by this app; drained if mount fails. */
	readonly subscriptions: Set<() => void>;
};

export const componentContextKey: InjectionKey<VueComponentContext> = Symbol('makoo-component');

export type VueMakooComponent = Omit<ComponentControl, 'state' | 'listenerState'> & {
	readonly state: Readonly<Ref<Readonly<ComponentSnapshot>>>;
	listenerState(name: string): Readonly<Ref<Readonly<ListenerSnapshot>>>;
};

export function useMakooComponent(): VueMakooComponent {
	const context = hasInjectionContext() ? inject(componentContextKey, null) : null;
	if (!context) {
		throw new MakooError(
			'useMakooComponent() must be called inside a component mounted by the Makoo Vue adapter'
		);
	}
	if (!getCurrentScope()) {
		throw new MakooError(
			'useMakooComponent() must be called inside a component setup or effect scope'
		);
	}
	const { control, listenerNames } = context;
	const state = subscribeState(control.state, context.subscriptions);
	const listeners = new Map(
		listenerNames.map((name) => [
			name,
			subscribeState(control.listenerState(name), context.subscriptions)
		])
	);
	return {
		name: control.name,
		state,
		get lastError() {
			return control.lastError;
		},
		start: control.start,
		stop: control.stop,
		remove: control.remove,
		listenerState(name) {
			const listener = listeners.get(name);
			if (!listener)
				throw new MakooError(
					`Unknown listener "${name}" in "${control.name}"`,
					undefined,
					ErrorCode.INJECTION_NOT_FOUND
				);
			return listener;
		}
	};
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
