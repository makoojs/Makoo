export type DOMObserver = ReturnType<typeof createDOMObserver>;

export function createDOMObserver() {
	const checks = new Set<() => void>();
	let observer: MutationObserver | undefined;
	return {
		subscribe(check: () => void, signal: AbortSignal): () => void {
			if (signal.aborted) return () => {};
			if (!observer) {
				const next = new MutationObserver(() => {
					// New registrations perform their own initial check, outside this delivery.
					for (const current of [...checks]) {
						if (checks.has(current)) current();
					}
				});
				observer = next;
			}
			if (!checks.size)
				observer.observe(document, {
					subtree: true,
					childList: true,
					attributes: true,
					characterData: true
				});
			checks.add(check);
			const cancel = () => {
				if (!checks.delete(check)) return;
				signal.removeEventListener('abort', cancel);
				if (!checks.size) {
					observer?.disconnect();
				}
			};
			signal.addEventListener('abort', cancel, { once: true });
			return cancel;
		}
	};
}
