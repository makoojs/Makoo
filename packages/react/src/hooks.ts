import type {
	AdapterMountParams,
	ComponentCommand,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerCommand,
	ListenerStatus,
	StateView
} from '@makoojs/core';
import { MakooError } from '@makoojs/core';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { ReactErrorCode } from './error';

type MakooComponentContextValue = {
	command: ComponentCommand;
	status: ComponentStatusHandle;
	globalListener: AdapterMountParams['globalListener'];
};

type ReactStandaloneListener = ListenerCommand & {
	readonly status: ListenerStatus;
	readonly lastError: MakooError | undefined;
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
export function useAttachedListenerStatus(name: string): ListenerStatus;
export function useAttachedListenerStatus<T>(
	name: string,
	select: (status: ListenerStatus) => T
): T;
export function useAttachedListenerStatus<T>(name: string, select?: (status: ListenerStatus) => T) {
	const { status } = useComponentContext();
	return useSelectedState(status.attachedListener(name), select);
}

/** Looks up a standalone listener in this Core Instance and subscribes to its status. */
export function useGlobalListener(name: string): ReactStandaloneListener {
	const { globalListener } = useComponentContext();
	const found = globalListener(name);
	const status = useSelectedState(found.status);
	return {
		name: found.command.name,
		start: found.command.start,
		stop: found.command.stop,
		remove: found.command.remove,
		status,
		get lastError() {
			return found.status.lastError;
		}
	};
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

function useSelectedState<Snapshot, Selection = Snapshot>(
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
