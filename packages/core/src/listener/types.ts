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
 *   `lastError`. After a cleanup failure the listener cannot start again.
 */
export type ListenerStatus = 'idle' | 'waiting' | 'bound' | 'failed';

/** Control entry bound to one standalone listener; it never controls a later listener with the same name. */
export interface ListenerCommand {
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
	 * Unbinds the listener. The status becomes `idle` on success, or `failed` when unbinding fails.
	 *
	 * @returns A promise that settles when cleanup finishes; it rejects with a
	 * `MakooAggregateError` (`INJECTION_CLEANUP_FAILED`) when unbinding fails, after which the
	 * listener cannot start again.
	 */
	stop(): Promise<void>;
	/**
	 * Stops the listener and unregisters it from the Core Instance once cleanup succeeds.
	 *
	 * @returns The same cleanup promise as {@link ListenerCommand.stop}.
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

export type ListenerInjection = {
	readonly kind: 'listener';
	readonly command: ListenerCommand;
	readonly statusHandle: ListenerStatusHandle;
};
