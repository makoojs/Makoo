import type { StateView } from './types';

export function createState<T extends string>(initial: T, report: (cause: unknown) => void) {
	let snapshot: T = initial;
	const subscribers = new Set<() => void>();
	const view: StateView<T> = Object.freeze({
		getSnapshot: () => snapshot,
		subscribe(notify: () => void) {
			subscribers.add(notify);
			return () => {
				subscribers.delete(notify);
			};
		}
	});
	return {
		view,
		set(next: T) {
			if (Object.is(snapshot, next)) return;
			snapshot = next;
			for (const notify of [...subscribers]) {
				try {
					notify();
				} catch (cause) {
					report(cause);
				}
			}
		}
	};
}
