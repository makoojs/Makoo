import { describe, expect, it, vi } from 'vitest';
import { createAdapterRegistry } from '../src/adapter/Adapter';
import type { ResolvableMountAdapter } from '../src/adapter/types';

function createAdapter(
	name: string,
	matches: (artifact: unknown) => boolean
): ResolvableMountAdapter {
	return {
		name,
		matches: vi.fn(matches) as unknown as ResolvableMountAdapter['matches'],
		mount: vi.fn(() => ({ handle: { name } })),
		unmount: vi.fn()
	};
}

describe('createAdapterRegistry', () => {
	it('should register adapters and resolve the first adapter that matches an artifact', () => {
		const registry = createAdapterRegistry();
		const first = createAdapter('first', (artifact) => artifact === 'target');
		const second = createAdapter('second', (artifact) => artifact === 'target');

		registry.use(first);
		registry.use(second);

		expect(registry.resolve('target')).toBe(first);
	});

	it('should preserve adapter registration order when resolving', () => {
		const registry = createAdapterRegistry();
		const first = createAdapter('first', (artifact) => artifact === 'other');
		const second = createAdapter('second', (artifact) => artifact === 'target');

		registry.use(first);
		registry.use(second);

		expect(registry.resolve('target')).toBe(second);
	});

	it('should ignore duplicate adapter instances', () => {
		const registry = createAdapterRegistry();
		const adapter = createAdapter('dedupe', (artifact) => artifact === 'target');

		registry.use(adapter);
		registry.use(adapter);

		expect(registry.resolve('target')).toBe(adapter);
		expect(adapter.matches).toHaveBeenCalledTimes(1);
	});

	it('should return undefined when no adapter matches', () => {
		const registry = createAdapterRegistry();
		const adapter = createAdapter('miss', (artifact) => artifact === 'target');

		registry.use(adapter);

		expect(registry.resolve('missing')).toBeUndefined();
	});
});
