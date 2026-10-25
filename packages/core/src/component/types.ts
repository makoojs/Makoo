import type { MakooError } from '../error/MakooError';
import type { ListenerStatus, MakooListenerDeclaration } from '../listener/types';
import type { StateView } from '../state/types';

/**
 * One Child Injection under an Each Injection. Not registered in the top-level name map.
 * Shaped like a component injection so adapter mount params and in-component hooks bind to it.
 */
export type ChildInjection = ComponentInjection;

/** Control entry bound to one component; it never controls a later component with the same name. */
export interface ComponentCommand {
	/** The injection name. */
	readonly name: string;
	/**
	 * Starts a new execution, or keeps the current one running. Clears `lastError` when a new
	 * execution begins.
	 *
	 * @throws {@link MakooError} `INJECTION_REMOVED` after removal, `INJECTION_CLOSED` after a
	 * cleanup failure, or `INSTANCE_DISPOSED` once the Core Instance is disposed.
	 */
	start(): void;
	/**
	 * Stops the attached listeners, then unmounts the component. The status becomes `idle` on
	 * success, or `failed` when cleanup fails.
	 *
	 * @returns A promise that settles when cleanup finishes; it rejects with a
	 * `MakooAggregateError` (`INJECTION_CLEANUP_FAILED`) when cleanup fails, after which the
	 * component cannot start again.
	 */
	stop(): Promise<void>;
	/**
	 * Stops the component and unregisters it from the Core Instance once cleanup succeeds.
	 *
	 * @returns The same cleanup promise as {@link ComponentCommand.stop}.
	 */
	remove(): Promise<void>;
}

/** Control bag for an Each Injection: group command/status plus a snapshot of live Children. */
export type ComponentEachInjection = {
	readonly kind: 'component-each';
	readonly command: ComponentCommand;
	readonly statusHandle: ComponentEachStatusHandle;
	/** Document-order snapshot of currently live Child bags; each read returns a new array. */
	readonly children: readonly ChildInjection[];
};

/**
 * The run phase of an Each Injection.
 *
 * - `idle`: not started yet, or stopped.
 * - `collecting`: started; mounting current matches and (when continuous collect is active)
 *   waiting for later ones. Zero matches stay here without a target-wait timeout.
 * - `failed`: a group-level orchestration or cleanup failure; see `lastError`.
 */
export type ComponentEachStatus = 'idle' | 'collecting' | 'failed';

/** Read-only status of an Each Injection. */
export interface ComponentEachStatusHandle extends StateView<ComponentEachStatus> {
	/** The error that ended the last group-level failure; reading it does not subscribe. */
	readonly lastError: MakooError | undefined;
}

export type ComponentInjection = {
	readonly kind: 'component';
	readonly command: ComponentCommand;
	readonly statusHandle: ComponentStatusHandle;
};

/**
 * The run phase of a component.
 *
 * - `idle`: not started yet, or stopped.
 * - `waiting`: looking for the mount target, or mounting into it.
 * - `mounted`: mounted, with every attached listener started.
 * - `failed`: the last execution ended in an execution failure or a cleanup failure; see
 *   `lastError`. After a cleanup failure the component cannot start again.
 */
export type ComponentStatus = 'idle' | 'waiting' | 'mounted' | 'failed';

/** Read-only status of one component, plus the status of each attached listener. */
export interface ComponentStatusHandle extends StateView<ComponentStatus> {
	/** The error that ended the last execution; reading it does not subscribe. */
	readonly lastError: MakooError | undefined;
	/** Names of the attached listeners, in declaration order. */
	readonly attachedListenerNames: readonly string[];
	/**
	 * Returns the status view of an attached listener.
	 *
	 * @throws {@link MakooError} `LISTENER_NOT_FOUND` when the component has no listener with that name.
	 */
	attachedListener(name: string): StateView<ListenerStatus>;
}

/** A component declaration created by `inject()`; it does nothing until applied to a Core Instance. */
export type MakooComponentDeclaration<TComponent = unknown, TProps = unknown> = Readonly<
	MakooComponentInput<TComponent, TProps> & { kind: 'component' }
>;

/** An Each Injection declaration created by `injectEach()`; inert until applied. */
export type MakooComponentEachDeclaration<TComponent = unknown, TProps = unknown> = Readonly<
	MakooComponentEachInput<TComponent, TProps> & { kind: 'component-each' }
>;

/** Options for `injectEach()`: mount the same component on every matching host element. */
export interface MakooComponentEachInput<TComponent = unknown, TProps = unknown> {
	/** Injection name, unique among the top-level injections of a Core Instance. */
	name: string;
	/** CSS selector; every current match receives a Child Injection (document order). */
	injectAt: string;
	/** Name of a component adapter registered with `useAdapter()`. */
	adapter: string;
	/** The framework component, passed to the adapter unchanged. */
	component: TComponent;
	/** Root props, shared by reference across every Child. */
	props?: TProps;
}

/** Options for `inject()`: a framework component to mount into a host page element. */
export interface MakooComponentInput<TComponent = unknown, TProps = unknown> {
	/** Injection name, unique among the top-level injections of a Core Instance. */
	name: string;
	/** CSS selector of the mount target; the first match receives the component container. */
	injectAt: string;
	/** Name of a component adapter registered with `useAdapter()`. */
	adapter: string;
	/** The framework component, passed to the adapter unchanged. */
	component: TComponent;
	/** Root props, passed to the adapter unchanged. */
	props?: TProps;
	/** DOM search budget in milliseconds. Defaults to 15000. */
	timeout?: number;
	/** Recover when the mount target or component container becomes invalid. */
	reinject?: boolean;
	/** Named host-page listeners owned by this component. */
	listeners?: readonly Omit<MakooListenerDeclaration, 'reinject'>[];
}
