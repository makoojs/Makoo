import type {
	ComponentControl,
	ComponentSnapshot,
	ListenerSnapshot,
	StateView
} from '@makoojs/core';
import { MakooError } from '@makoojs/core';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

export const MakooComponentContext = createContext<ComponentControl | null>(null);

export type ReactComponentControl = Pick<
	ComponentControl,
	'name' | 'lastError' | 'start' | 'stop' | 'remove'
>;

/** Returns stable controls; reading lastError does not establish a subscription. */
export function useComponentControl(): ReactComponentControl {
	const control = useComponentContext();
	return useMemo(
		() => ({
			name: control.name,
			get lastError() {
				return control.lastError;
			},
			start: control.start,
			stop: control.stop,
			remove: control.remove
		}),
		[control]
	);
}

/** Subscribes to the component snapshot, or to a selector result compared with Object.is. */
export function useComponentState(): Readonly<ComponentSnapshot>;
export function useComponentState<T>(select: (state: Readonly<ComponentSnapshot>) => T): T;
export function useComponentState<T>(select?: (state: Readonly<ComponentSnapshot>) => T) {
	const { state } = useComponentContext();
	return useSelectedState(state, select);
}

/** Subscribes only to the named attached listener; selector results use Object.is. */
export function useListenerState(name: string): Readonly<ListenerSnapshot>;
export function useListenerState<T>(
	name: string,
	select: (state: Readonly<ListenerSnapshot>) => T
): T;
export function useListenerState<T>(
	name: string,
	select?: (state: Readonly<ListenerSnapshot>) => T
) {
	const control = useComponentContext();
	return useSelectedState(control.listenerState(name), select);
}

function useComponentContext(): ComponentControl {
	const control = useContext(MakooComponentContext);
	if (!control) {
		throw new MakooError(
			'Makoo hooks must be called inside a component mounted by the Makoo React adapter'
		);
	}
	return control;
}

function useSelectedState<Snapshot, Selection>(
	view: StateView<Snapshot>,
	select?: (state: Readonly<Snapshot>) => Selection
) {
	const getSnapshot = useMemo(() => {
		let snapshot = view.getSnapshot();
		let selection = select ? select(snapshot) : snapshot;
		return () => {
			const nextSnapshot = view.getSnapshot();
			if (!Object.is(snapshot, nextSnapshot)) {
				selection = select ? select(nextSnapshot) : nextSnapshot;
				snapshot = nextSnapshot;
			}
			return selection;
		};
	}, [view, select]);
	return useSyncExternalStore(view.subscribe, getSnapshot, getSnapshot);
}
