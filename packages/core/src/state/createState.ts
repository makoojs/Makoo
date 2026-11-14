import { coreErrors } from '../error/coreErrors';
import type { MakooError } from '../error/MakooError';
import type { StateView } from './types';

/** Emits a state-subscriber failure as a diagnostic of `report`. */
export function emitSubscriberDiagnostic(
	owner: string,
	cause: unknown,
	report: (error: MakooError) => void
): void {
	const error = coreErrors.create('MAKOO_STATE_SUBSCRIBER_FAILED', { owner }, { cause });
	console.error(error);
	report(error);
}

export function createState<T extends string>(
	initial: T,
	onSubscriberError: (cause: unknown) => void
) {
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
					onSubscriberError(cause);
				}
			}
		}
	};
}
