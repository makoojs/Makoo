import type {
	ChildCommand,
	ChildInjection,
	ChildStatusHandle,
	ComponentCommand,
	ComponentInjection,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerInjection,
	ListenerStatus,
	MakooError,
	StateView
} from '@makoojs/core';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { reactErrors } from './error';

type MakooComponentContextValue = {
	injection: ComponentInjection | ChildInjection;
	listener: (name: string) => ListenerInjection;
};

type ReactStandaloneListener = Pick<
	ListenerInjection,
	'lastError' | 'name' | 'remove' | 'start' | 'stop'
> & {
	/** The listener status at the last render. */
	readonly status: ListenerStatus;
};

export const MakooComponentContext = createContext<MakooComponentContextValue | null>(null);

/**
 * Returns the stable command for this mount: a full `ComponentCommand` for a top-level
 * injection, or a `ChildCommand` (`{ name, stop }`) inside an Each Child.
 *
 * Every Makoo hook throws a {@link MakooError} with `REACT_HOOK_OUTSIDE_COMPONENT` when called
 * outside a component tree mounted by the React adapter.
 */
export function useComponentCommand(): ComponentCommand | ChildCommand {
	return useComponentContext().injection.command;
}

/** Returns the raw status handle for this mount; reading it, including lastError, does not subscribe. */
export function useComponentStatusHandle(): ComponentStatusHandle | ChildStatusHandle {
	return useComponentContext().injection.statusHandle;
}

/**
 * Subscribes to the component status, or to a selector result compared with Object.is.
 * Pass a stable `select`; a new function on each render recomputes the selection.
 */
export function useComponentStatus(): ComponentStatus;
export function useComponentStatus<T>(select: (status: ComponentStatus) => T): T;
export function useComponentStatus<T>(select?: (status: ComponentStatus) => T) {
	const { statusHandle } = useComponentContext().injection;
	return useSelectedSnapshot(statusHandle, select);
}

/**
 * Subscribes only to the named attached listener; selector results use Object.is.
 *
 * @throws {@link MakooError} `MAKOO_REACT_LISTENER_NOT_FOUND` when the component has no listener with that name.
 */
export function useAttachedListenerStatus(name: string): ListenerStatus;
export function useAttachedListenerStatus<T>(
	name: string,
	select: (status: ListenerStatus) => T
): T;
export function useAttachedListenerStatus<T>(name: string, select?: (status: ListenerStatus) => T) {
	const { command, statusHandle } = useComponentContext().injection;
	const view =
		'attachedListener' in statusHandle && statusHandle.attachedListenerNames.includes(name)
			? statusHandle.attachedListener(name)
			: null;
	if (!view) {
		throw reactErrors.createThrowable('MAKOO_REACT_LISTENER_NOT_FOUND', {
			name,
			injection: command.name
		});
	}
	return useSelectedSnapshot(view, select);
}

/**
 * Looks up a standalone listener in this Core Instance and subscribes to its status.
 *
 * The commands are those of `core.listener(name)`; `lastError` (the latest execution or
 * cleanup failure) is read live and does not subscribe.
 *
 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no standalone listener has that name.
 */
export function useListener(name: string): ReactStandaloneListener {
	const { listener } = useComponentContext();
	const found = listener(name);
	const view = useMemo<StateView<ListenerStatus>>(
		() => ({ getSnapshot: () => found.status, subscribe: found.subscribe }),
		[found]
	);
	const status = useSelectedSnapshot(view);
	return {
		name: found.name,
		start: found.start,
		stop: found.stop,
		remove: found.remove,
		status,
		get lastError() {
			return found.lastError;
		}
	};
}

function useComponentContext(): MakooComponentContextValue {
	const context = useContext(MakooComponentContext);
	if (!context) {
		throw reactErrors.createThrowable('MAKOO_REACT_HOOK_OUTSIDE_COMPONENT');
	}
	return context;
}

function useSelectedSnapshot<Snapshot, Selection = Snapshot>(
	view: StateView<Snapshot>,
	select?: (snapshot: Readonly<Snapshot>) => Selection
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
