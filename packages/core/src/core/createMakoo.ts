import { z } from 'zod';
import { createAdapterRegistry } from '../adapter/registry';
import { createDOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { validateInjection } from '../injection/declaration';
import { createInjection } from '../injection/injection';
import type { MakooInjectionDeclaration } from '../injection/types';
import { validateListener } from '../listener/declaration';
import { createListener } from '../listener/listener';
import type { MakooListenerDeclaration } from '../listener/types';
import type { FeatureControl, MakooRuntime } from './types';

const featureKindSchema = z.object(
	{
		kind: z.enum(['listener', 'injection'], { error: 'Expected listener or injection' })
	},
	{
		error: (issue) => (issue.code === 'invalid_type' ? 'Invalid declaration' : undefined)
	}
);

function issuesOf(error: z.ZodError) {
	return error.issues.map((issue) => ({
		path: issue.path.length ? issue.path.join('.') : '(root)',
		message: issue.message
	}));
}

function validateFeature(input: unknown): MakooListenerDeclaration | MakooInjectionDeclaration {
	const kind = featureKindSchema.safeParse(input);
	if (!kind.success) {
		throw new MakooError(
			'Invalid declaration',
			issuesOf(kind.error),
			ErrorCode.INVALID_DECLARATION
		);
	}
	return kind.data.kind === 'listener' ? validateListener(input) : validateInjection(input);
}

export function createMakoo(): MakooRuntime {
	const features = new Map<string, FeatureControl>();
	const adapters = createAdapterRegistry();
	const dom = createDOMObserver();
	return {
		useAdapter(adapter) {
			adapters.use(adapter);
		},
		apply(declarations) {
			if (!Array.isArray(declarations) || declarations.length === 0) {
				throw new MakooError(
					'Expected a non-empty array of declarations',
					undefined,
					ErrorCode.INVALID_DECLARATION
				);
			}
			const configs = declarations.map(validateFeature);
			const names = new Set(features.keys());
			for (const config of configs) {
				if (names.has(config.name)) {
					throw new MakooError(
						`Feature name "${config.name}" is already occupied`,
						[{ path: 'name', message: config.name }],
						ErrorCode.FEATURE_NAME_CONFLICT
					);
				}
				names.add(config.name);
			}
			const prepared = configs.map((config) =>
				config.kind === 'listener'
					? { kind: 'listener' as const, config }
					: {
							kind: 'injection' as const,
							config,
							adapter: adapters.require(config.adapter)
						}
			);
			const accepted = prepared.map((feature) => {
				if (feature.kind === 'listener') {
					const listener = createListener(feature.config, dom, () => {
						if (features.get(feature.config.name) === listener) {
							features.delete(feature.config.name);
						}
					});
					features.set(feature.config.name, listener);
					return listener;
				}
				const injection = createInjection(feature.config, feature.adapter, dom, () => {
					if (features.get(feature.config.name) === injection) {
						features.delete(feature.config.name);
					}
				});
				features.set(feature.config.name, injection);
				return injection;
			});
			for (const feature of accepted) {
				// An earlier mount may have removed or replaced a later record.
				if (features.get(feature.name) === feature) feature.start();
			}
		},
		get(name) {
			const feature = features.get(name);
			if (!feature) {
				throw new MakooError(
					`Unknown feature "${name}"`,
					undefined,
					ErrorCode.FEATURE_NOT_FOUND
				);
			}
			return feature;
		}
	};
}
