import type { AdapterRegistry, ResolvableMountAdapter } from './types';

export function createAdapterRegistry(): AdapterRegistry {
	const adapters: ResolvableMountAdapter[] = [];

	return {
		resolve(artifact) {
			const resolvedAdapter = adapters.find((adapter) => adapter.matches(artifact));
			return resolvedAdapter;
		},
		use(adapter) {
			if (adapters.includes(adapter)) return;
			adapters.push(adapter);
		}
	};
}
