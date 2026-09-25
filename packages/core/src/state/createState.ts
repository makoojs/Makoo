import type { StateView } from './types';

export function createState<T extends object>(initial: T) {
	let snapshot: Readonly<T> = Object.freeze({ ...initial });
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
			if (
				Object.keys(next).every((key) =>
					Object.is(next[key as keyof T], snapshot[key as keyof T])
				)
			)
				return;
			snapshot = Object.freeze({ ...next });
			for (const notify of [...subscribers]) {
				try {
					notify();
				} catch (error) {
					console.error(error);
				}
			}
		}
	};
}
