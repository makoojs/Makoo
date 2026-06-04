import type {
	ActivitySignalListener,
	ActivitySignalSource,
	ActivitySignalStore,
	SignalUnsubscribe,
	WritableActivitySignalStore
} from './types';

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === 'object' && value !== null;
}

function isActivitySignalStore<T>(
	source: ActivitySignalSource<T>
): source is ActivitySignalStore<T> {
	return (
		isObjectLike(source) &&
		'get' in source &&
		'subscribe' in source &&
		typeof source.get === 'function' &&
		typeof source.subscribe === 'function'
	);
}

function normalizeActivitySignal<T>(source: ActivitySignalSource<T>): ActivitySignalStore<T> {
	if (isActivitySignalStore(source)) {
		return source;
	}

	throw new TypeError('Invalid activity signal source');
}

export function createActivityStore<T>(initialValue: T): WritableActivitySignalStore<T> {
	let currentValue = initialValue;
	const listeners = new Set<ActivitySignalListener<T>>();

	const setValue = (value: T): void => {
		if (Object.is(currentValue, value)) {
			return;
		}

		currentValue = value;
		for (const listener of listeners) {
			listener(currentValue);
		}
	};

	return {
		get() {
			return currentValue;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		set(value) {
			setValue(value);
		},
		update(updater) {
			setValue(updater(currentValue));
		}
	};
}

/**
 * @deprecated Passing a `ref`-like source will be removed in 2.0.
 * Use `ActivitySignalStore` instead.
 */
export function observeActivitySignal<T>(
	source: ActivitySignalSource<T>,
	listener: (value: T) => void
): SignalUnsubscribe {
	const normalizedSource = normalizeActivitySignal(source);
	listener(normalizedSource.get());
	return normalizedSource.subscribe(listener);
}

export function stopActivitySignal(signal: SignalUnsubscribe): void {
	if (typeof signal === 'function') {
		signal();
		return;
	}
	signal.unsubscribe();
}
