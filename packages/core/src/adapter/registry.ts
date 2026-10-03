import { z } from 'zod';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { MountAdapter } from './types';

const adapterSchema = z.object(
	{
		name: z
			.string({ error: 'Expected a non-empty string' })
			.refine((value) => value.trim().length > 0, 'Expected a non-empty string'),
		mount: z.custom<(params: never) => unknown>(
			(value) => typeof value === 'function',
			'Expected a mount function'
		),
		unmount: z.custom<(handle: unknown) => void>(
			(value) => typeof value === 'function',
			'Expected an unmount function'
		)
	},
	{
		error: (issue) => (issue.code === 'invalid_type' ? 'Expected an adapter' : undefined)
	}
);

export function createAdapterRegistry() {
	const adapters = new Map<string, MountAdapter>();
	return {
		use(adapter: MountAdapter) {
			const parsed = adapterSchema.safeParse(adapter);
			if (!parsed.success) {
				throw new MakooError(
					'Invalid adapter',
					parsed.error.issues.map((issue) => ({
						path: issue.path.length ? issue.path.join('.') : '(root)',
						message: issue.message
					})),
					ErrorCode.INVALID_DECLARATION
				);
			}
			if (adapters.has(parsed.data.name)) {
				throw new MakooError(
					`Adapter "${parsed.data.name}" is already registered`,
					[{ path: 'name', message: parsed.data.name }],
					ErrorCode.ADAPTER_NAME_CONFLICT
				);
			}
			adapters.set(parsed.data.name, adapter);
		},
		require(name: string) {
			const adapter = adapters.get(name);
			if (!adapter) {
				throw new MakooError(
					`Unknown adapter "${name}"`,
					[{ path: 'adapter', message: name }],
					ErrorCode.ADAPTER_NOT_FOUND
				);
			}
			return adapter;
		}
	};
}
