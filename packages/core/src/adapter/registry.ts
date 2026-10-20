import { MakooErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { MountAdapter } from './types';

export function createAdapterRegistry() {
	const adapters = new Map<string, MountAdapter>();
	return {
		use(adapter: MountAdapter) {
			if (adapters.has(adapter.name)) {
				throw new MakooError(`Adapter "${adapter.name}" is already registered`, {
					code: MakooErrorCode.ADAPTER_NAME_CONFLICT
				});
			}
			adapters.set(adapter.name, adapter);
		},
		require(name: string) {
			const adapter = adapters.get(name);
			if (!adapter) {
				throw new MakooError(`Unknown adapter "${name}"`, {
					code: MakooErrorCode.ADAPTER_NOT_FOUND
				});
			}
			return adapter;
		}
	};
}
