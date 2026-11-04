import { coreErrors } from '../error/coreErrors';
import type { MountAdapter } from './types';

export function createAdapterRegistry() {
	const adapters = new Map<string, MountAdapter>();
	return {
		use(adapter: MountAdapter) {
			if (adapters.has(adapter.name)) {
				throw coreErrors.createThrowable('MAKOO_ADAPTER_NAME_CONFLICT', {
					name: adapter.name
				});
			}
			adapters.set(adapter.name, adapter);
		},
		require(name: string) {
			const adapter = adapters.get(name);
			if (!adapter) {
				throw coreErrors.createThrowable('MAKOO_ADAPTER_NOT_FOUND', { name });
			}
			return adapter;
		}
	};
}
