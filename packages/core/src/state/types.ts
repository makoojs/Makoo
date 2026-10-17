/** A read-only view of run state; shaped for `useSyncExternalStore` and similar consumers. */
export interface StateView<T> {
	/** Returns the current state; the value keeps its identity while the state is unchanged. */
	getSnapshot(): Readonly<T>;
	/**
	 * Calls `notify` after each state change. A throwing `notify` is reported as
	 * `STATE_SUBSCRIBER_FAILED` and does not stop other subscribers.
	 *
	 * @returns A function that ends the subscription.
	 */
	subscribe(notify: () => void): () => void;
}
