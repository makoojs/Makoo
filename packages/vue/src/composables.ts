import type {
	ComponentCommand,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerStatus,
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
	readonly command: ComponentCommand;
	readonly status: ComponentStatusHandle;
	/** Releases of subscriptions still held by this app; drained if mount fails. */
	readonly subscriptions: Set<() => void>;
};

export const componentContextKey: InjectionKey<VueComponentContext> = Symbol('makoo-component');

export type VueMakooComponent = ComponentCommand & {
	readonly lastError: MakooError | undefined;
	readonly status: Readonly<Ref<ComponentStatus>>;
	listener(name: string): Readonly<Ref<ListenerStatus>>;
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
	const { command, status } = context;
	const componentStatus = subscribeState(status, context.subscriptions);
	const listeners = new Map(
		status.listenerNames.map((name) => [
			name,
			subscribeState(status.listener(name), context.subscriptions)
		])
	);
	return {
		name: command.name,
		status: componentStatus,
		get lastError() {
			return status.lastError;
		},
		start: command.start,
		stop: command.stop,
		remove: command.remove,
		listener(name) {
			const listener = listeners.get(name);
			if (!listener)
				throw new MakooError(
					`Unknown listener "${name}" in "${command.name}"`,
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
