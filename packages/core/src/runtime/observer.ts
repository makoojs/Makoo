export type DOMObserver = {
	subscribe(subscriber: () => void, signal: AbortSignal): () => void;
};

/**
 * The shared MutationObserver of a Core Instance: one observer for the whole document,
 * one delivery wraps all subscribed checks in a single outermost operation.
 * Watches childList and attributes only — text changes never reach a selector match.
 */
export function createDomObserver(operation: (run: () => void) => void): DOMObserver {
	const subscribers = new Set<() => void>();
	let mutationObserver: MutationObserver | undefined;

	const notifySubscribers = () =>
		operation(() => {
			// New subscribers perform their own initial check, outside this delivery.
			for (const subscriber of [...subscribers]) {
				if (subscribers.has(subscriber)) subscriber();
			}
		});

	return {
		subscribe(subscriber, signal) {
			if (signal.aborted) return () => {};
			mutationObserver ??= new MutationObserver(notifySubscribers);
			if (!subscribers.size)
				mutationObserver.observe(document, {
					subtree: true,
					childList: true,
					attributes: true
				});
			subscribers.add(subscriber);
			const unsubscribe = () => {
				if (!subscribers.delete(subscriber)) return;
				signal.removeEventListener('abort', unsubscribe);
				if (!subscribers.size) mutationObserver?.disconnect();
			};
			signal.addEventListener('abort', unsubscribe, { once: true });
			return unsubscribe;
		}
	};
}
