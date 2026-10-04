import type {
	ComponentCommand,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerStatus,
	StateView
} from '@makoojs/core';
import { MakooError } from '@makoojs/core';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { ReactErrorCode } from './error';

type MakooComponentContextValue = {
	command: ComponentCommand;
	status: ComponentStatusHandle;
};

export const MakooComponentContext = createContext<MakooComponentContextValue | null>(null);

/** Returns the stable command for this mount. */
export function useComponentCommand(): ComponentCommand {
	return useComponentContext().command;
}

/** Returns the raw status handle for this mount; reading it, including lastError, does not subscribe. */
export function useComponentStatusHandle(): ComponentStatusHandle {
	return useComponentContext().status;
}

/** Subscribes to the component status, or to a selector result compared with Object.is. */
export function useComponentStatus(): ComponentStatus;
export function useComponentStatus<T>(select: (status: ComponentStatus) => T): T;
export function useComponentStatus<T>(select?: (status: ComponentStatus) => T) {
	const { status } = useComponentContext();
	return useSelectedState(status, select);
}

/** Subscribes only to the named attached listener; selector results use Object.is. */
export function useListenerStatus(name: string): ListenerStatus;
export function useListenerStatus<T>(name: string, select: (status: ListenerStatus) => T): T;
export function useListenerStatus<T>(name: string, select?: (status: ListenerStatus) => T) {
	const { status } = useComponentContext();
	return useSelectedState(status.listener(name), select);
}

function useComponentContext(): MakooComponentContextValue {
	const context = useContext(MakooComponentContext);
	if (!context) {
		throw new MakooError(
			'Makoo hooks must be called inside a component mounted by the Makoo React adapter',
			{ code: ReactErrorCode.REACT_HOOK_OUTSIDE_COMPONENT }
		);
	}
	return context;
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
