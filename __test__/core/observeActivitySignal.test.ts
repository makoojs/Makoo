import { describe, expect, it, vi } from 'vitest';
import {
	createActivityStore,
	observeActivitySignal,
	stopActivitySignal
} from '../../packages/core/src/signal/observeActivitySignal';
import type { ActivitySignalSource } from '../../packages/core/src/signal/types';

describe('observeActivitySignal', () => {
	it('should observe protocol stores via get and subscribe', () => {
		const store = createActivityStore(false);
		const listener = vi.fn();

		const unsubscribe = observeActivitySignal(store, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenNthCalledWith(1, false);

		store.set(true);
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenNthCalledWith(2, true);

		stopActivitySignal(unsubscribe);
		store.set(false);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('should read the current value before subscribing to protocol stores', () => {
		const listener = vi.fn();
		const source = {
			get: () => true,
			subscribe: vi.fn(() => () => {})
		};

		const unsubscribe = observeActivitySignal(source, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(true);
		expect(source.subscribe).toHaveBeenCalledWith(listener);
		expect(typeof unsubscribe).toBe('function');
	});

	it('should reject invalid signal sources', () => {
		const listener = vi.fn();

		expect(() =>
			observeActivitySignal({ value: false } as unknown as ActivitySignalSource, listener)
		).toThrow(TypeError);
		expect(listener).not.toHaveBeenCalled();
	});
});
