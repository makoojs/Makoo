import type { MakooError } from '../error/MakooError';
import type { StateView } from '../state/types';

/** Options for `listen()`: an event listener on a host page element. */
export interface MakooListenerInput {
	/** Listener name, unique within its owning Core Instance or component. */
	name: string;
	/** CSS selector of the listener target; the first match is bound. */
	listenAt: string;
	/** DOM event type, such as `click`. */
	type: string;
	/**
	 * Event handler, called with the listener target as `this`. A throw or rejected promise is
	 * reported as `LISTENER_CALLBACK_FAILED` and leaves the listener bound.
	 */
	callback: (this: Element, event: Event) => unknown;
	/** Passed to `addEventListener` as the `capture` option. */
	capture?: boolean;
	/** DOM search budget in milliseconds. Defaults to 15000. */
	timeout?: number;
	/** Recover after the bound host disconnects. Defaults to false. */
	reinject?: boolean;
}

/** A listener declaration created by `listen()`; it does nothing until applied. */
export type MakooListenerDeclaration = Readonly<MakooListenerInput & { kind: 'listener' }>;

/**
 * The availability of a host listener.
 *
 * - `idle`: not started yet, or stopped.
 * - `waiting`: looking for the listener target.
 * - `bound`: the event listener is attached to the target.
 * - `failed`: the last execution ended in an execution failure or a cleanup failure; see
 *   `lastError`. A standalone listener may start again after a cleanup failure; the
 *   affected element stays residue-locked.
 */
export type ListenerStatus = 'idle' | 'waiting' | 'bound' | 'failed';

/**
 * Control entry bound to one standalone listener; it never controls a later listener with
 * the same name. Framework adapters keep this legacy Promise surface until the adapter
 * migration ticket; the wrapped commands settle immediately since core commands are void.
 */
export interface ListenerCommand {
	/** The injection name. */
	readonly name: string;
	/**
	 * Starts a new execution, or keeps the current one running. Clears `lastError` when a new
	 * execution begins. A cleanup-failed listener may start again; its affected elements stay
	 * residue-locked.
	 *
	 * @throws {@link MakooError} `INJECTION_REMOVED` after removal, or `INSTANCE_DISPOSED`
	 * once the Core Instance is disposed.
	 */
	start(): void;
	/**
	 * Unbinds the listener. The status becomes `idle` on success, or `failed` with
	 * `MAKOO_INJECTION_CLEANUP_FAILED` in `lastError` when unbinding fails.
	 */
	stop(): Promise<void>;
	/**
	 * Stops the listener and unregisters it from the Core Instance, freeing the name even when
	 * unbinding fails; the affected element stays residue-locked for a same-name re-apply.
	 */
	remove(): Promise<void>;
}

/** Read-only status of one standalone listener. */
export interface ListenerStatusHandle extends StateView<ListenerStatus> {
	/**
	 * The latest execution failure, cleanup failure, or event handler error; a handler error does
	 * not change the status. Reading it does not subscribe.
	 */
	readonly lastError: MakooError | undefined;
}
