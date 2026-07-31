import { normalizeInjectionManifest, normalizeListenerManifest } from '../config/resolve';
import type {
	InjectionManifest,
	InjectionModuleConfig,
	ResolvedInjectionModule,
	ResolvedListener
} from '../config/types';
import { ManifestBindingNotFoundError } from '../error/MakooCliError';
import type {
	InjectionManifestBindings,
	ListenerManifestBindings,
	ManifestBinding,
	ScannerManifestBindings
} from './types';

type BuildManifestBindingsOptions = {
	manifest: InjectionManifest;
	manifestFile: string;
	manifestInjections: ResolvedInjectionModule[];
	moduleInjections: ResolvedInjectionModule[];
	moduleInjectionConfigs: Map<string, InjectionModuleConfig>;
	manifestListeners: ResolvedListener[];
	enabledInjections: ResolvedInjectionModule[];
	enabledListeners: ResolvedListener[];
};

type InjectionBindingSource = {
	config: InjectionModuleConfig;
	binding: ManifestBinding;
};

export function buildManifestBindings(
	options: BuildManifestBindingsOptions
): ScannerManifestBindings {
	const manifestInjectionSources = new Map<string, InjectionBindingSource>();
	const moduleInjectionSources = new Map<string, InjectionBindingSource>();
	const listenerBindings = new Map<string, ListenerManifestBindings>();
	const injectionKeys = getCollectionKeys(options.manifest.injections);
	const listenerKeys = getCollectionKeys(options.manifest.listeners);
	const injectionConfigs = normalizeInjectionManifest(options.manifest);
	const listenerConfigs = normalizeListenerManifest(options.manifest);

	options.manifestInjections.forEach((injection, index) => {
		manifestInjectionSources.set(injection.moduleId, {
			config: injectionConfigs[index],
			binding: {
				manifestFile: options.manifestFile,
				valuePath: ['injections', injectionKeys[index]]
			}
		});
	});
	options.moduleInjections.forEach((injection) => {
		if (!injection.moduleManifestFile) return;
		const config = options.moduleInjectionConfigs.get(injection.moduleId);
		if (!config) {
			throw new ManifestBindingNotFoundError('injection', injection.moduleId);
		}
		moduleInjectionSources.set(injection.moduleId, {
			config,
			binding: {
				manifestFile: injection.moduleManifestFile,
				valuePath: []
			}
		});
	});
	options.manifestListeners.forEach((listener, index) => {
		const baseBinding = {
			manifestFile: options.manifestFile,
			valuePath: ['listeners', listenerKeys[index]]
		};
		const listenerConfig = listenerConfigs[index];
		listenerBindings.set(listener.listenerId, {
			callback: appendValuePath(baseBinding, ['callback']),
			activitySignal: listenerConfig.activitySignal
				? appendValuePath(baseBinding, ['activitySignal'])
				: undefined
		});
	});

	return {
		injectionDefaults: options.manifest.injectionDefaults?.hooks
			? {
					hooks: {
						manifestFile: options.manifestFile,
						valuePath: ['injectionDefaults', 'hooks']
					}
				}
			: undefined,
		injections: Object.fromEntries(
			options.enabledInjections.map((injection) => {
				const manifestSource = manifestInjectionSources.get(injection.moduleId);
				const moduleSource = moduleInjectionSources.get(injection.moduleId);
				if (!manifestSource && !moduleSource) {
					throw new ManifestBindingNotFoundError('injection', injection.moduleId);
				}
				return [injection.moduleId, buildInjectionBindings(manifestSource, moduleSource)];
			})
		),
		listeners: selectBindings(
			options.enabledListeners.map((listener) => listener.listenerId),
			listenerBindings,
			'listener'
		)
	};
}

function buildInjectionBindings(
	manifestSource: InjectionBindingSource | undefined,
	moduleSource: InjectionBindingSource | undefined
): InjectionManifestBindings {
	const hooksSource = selectFieldSource('hooks', manifestSource, moduleSource);
	const onSource = selectFieldSource('on', manifestSource, moduleSource);

	return {
		hooks: hooksSource?.config.hooks
			? appendValuePath(hooksSource.binding, ['hooks'])
			: undefined,
		on: onSource?.config.on
			? {
					callback: appendValuePath(onSource.binding, ['on', 'callback']),
					activitySignal: onSource.config.on.activitySignal
						? appendValuePath(onSource.binding, ['on', 'activitySignal'])
						: undefined
				}
			: undefined
	};
}

function selectFieldSource(
	field: 'hooks' | 'on',
	manifestSource: InjectionBindingSource | undefined,
	moduleSource: InjectionBindingSource | undefined
): InjectionBindingSource | undefined {
	if (moduleSource && Object.hasOwn(moduleSource.config, field)) {
		return moduleSource;
	}
	return manifestSource;
}

function appendValuePath(binding: ManifestBinding, valuePath: ManifestBinding['valuePath']) {
	return {
		manifestFile: binding.manifestFile,
		valuePath: [...binding.valuePath, ...valuePath]
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
	bindings: Map<string, ListenerManifestBindings>,
	kind: 'injection' | 'listener'
): Record<string, ListenerManifestBindings> {
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
