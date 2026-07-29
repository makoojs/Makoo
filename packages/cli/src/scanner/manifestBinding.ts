import type { InjectionManifest, ResolvedInjectionModule, ResolvedListener } from '../config/types';
import { ManifestBindingNotFoundError } from '../error/MakooCliError';
import type { ManifestBinding, ScannerManifestBindings } from './types';

export type BuildManifestBindingsOptions = {
	manifest: InjectionManifest;
	manifestFile: string;
	manifestInjections: ResolvedInjectionModule[];
	moduleInjections: ResolvedInjectionModule[];
	manifestListeners: ResolvedListener[];
	enabledInjections: ResolvedInjectionModule[];
	enabledListeners: ResolvedListener[];
};

export function buildManifestBindings(
	options: BuildManifestBindingsOptions
): ScannerManifestBindings {
	const injectionBindings = new Map<string, ManifestBinding>();
	const listenerBindings = new Map<string, ManifestBinding>();
	const injectionKeys = getCollectionKeys(options.manifest.injections);
	const listenerKeys = getCollectionKeys(options.manifest.listeners);

	options.manifestInjections.forEach((injection, index) => {
		injectionBindings.set(injection.moduleId, {
			manifestFile: options.manifestFile,
			valuePath: ['injections', injectionKeys[index]]
		});
	});
	options.moduleInjections.forEach((injection) => {
		if (!injection.moduleManifestFile) return;
		injectionBindings.set(injection.moduleId, {
			manifestFile: injection.moduleManifestFile,
			valuePath: []
		});
	});
	options.manifestListeners.forEach((listener, index) => {
		listenerBindings.set(listener.listenerId, {
			manifestFile: options.manifestFile,
			valuePath: ['listeners', listenerKeys[index]]
		});
	});

	return {
		injectionDefaults: options.manifest.injectionDefaults
			? {
					manifestFile: options.manifestFile,
					valuePath: ['injectionDefaults']
				}
			: undefined,
		injections: selectBindings(
			options.enabledInjections.map((injection) => injection.moduleId),
			injectionBindings,
			'injection'
		),
		listeners: selectBindings(
			options.enabledListeners.map((listener) => listener.listenerId),
			listenerBindings,
			'listener'
		)
	};
}

function getCollectionKeys(
	collection: InjectionManifest['injections'] | InjectionManifest['listeners']
): Array<string | number> {
	if (!collection) return [];
	return Array.isArray(collection)
		? collection.map((_, index) => index)
		: Object.keys(collection);
}

// Filter for enabled injections
function selectBindings(
	ids: string[],
	bindings: Map<string, ManifestBinding>,
	kind: 'injection' | 'listener'
): Record<string, ManifestBinding> {
	return Object.fromEntries(
		ids.map((id) => {
			const binding = bindings.get(id);
			if (!binding) {
				throw new ManifestBindingNotFoundError(kind, id);
			}
			return [id, binding];
		})
	);
}
