import type {
	ChildCommand,
	ChildInjection,
	ChildStatusHandle,
	ComponentCommand,
	ComponentInjection,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerCommand,
	ListenerInjection,
	ListenerStatus,
	StateView
} from '@makoojs/core';
import { MakooError, MakooErrorCode } from '@makoojs/core';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { ReactErrorCode } from './error';

type MakooComponentContextValue = {
	injection: ComponentInjection | ChildInjection;
	listener: (name: string) => ListenerInjection;
};

type ReactStandaloneListener = ListenerCommand & {
	/** The listener status at the last render. */
	readonly status: ListenerStatus;
	/** The latest execution failure, cleanup failure, or event handler error; reading it does not subscribe. */
	readonly lastError: MakooError | undefined;
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
 * @throws {@link MakooError} `LISTENER_NOT_FOUND` when the component has no listener with that name.
 */
export function useAttachedListenerStatus(name: string): ListenerStatus;
export function useAttachedListenerStatus<T>(
	name: string,
	select: (status: ListenerStatus) => T
): T;
export function useAttachedListenerStatus<T>(name: string, select?: (status: ListenerStatus) => T) {
	const { command, statusHandle } = useComponentContext().injection;
	const view = 'attachedListener' in statusHandle ? statusHandle.attachedListener(name) : null;
	if (!view) {
		throw new MakooError(`Unknown listener "${name}" in "${command.name}"`, {
			code: MakooErrorCode.LISTENER_NOT_FOUND
		});
	}
	return useSelectedSnapshot(view, select);
}

/**
 * Looks up a standalone listener in this Core Instance and subscribes to its status.
 *
 * Flat command methods and `status` wrap the same bag as `core.listener(name)`.
 *
 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no standalone listener has that name.
 */
export function useListener(name: string): ReactStandaloneListener {
	const { listener } = useComponentContext();
	const found = listener(name);
	const status = useSelectedSnapshot(found.statusHandle);
	return {
		name: found.command.name,
		start: found.command.start,
		stop: found.command.stop,
		remove: found.command.remove,
		status,
		get lastError() {
			return found.statusHandle.lastError;
		}
	};
}

function useComponentContext(): MakooComponentContextValue {
	const context = useContext(MakooComponentContext);
	if (!context) {
		throw new MakooError(
			'Makoo hooks must be called inside a component tree mounted by the Makoo React adapter',
			{ code: ReactErrorCode.REACT_HOOK_OUTSIDE_COMPONENT }
		);
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
