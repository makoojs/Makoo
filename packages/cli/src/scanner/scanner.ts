import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import {
	normalizeInjectionManifest,
	resolveInjection,
	resolveInjectionDefaults,
	resolveInjections,
	resolveListeners
} from '../config/resolve';
import type {
	InjectionModuleConfig,
	ResolvedConfig,
	ResolvedInjectionModule,
	ResolvedListener
} from '../config/types';
import {
	ManifestNotFoundError,
	NoEnabledTasksError,
	RuntimeSetupNotFoundError
} from '../error/MakooCliError';
import { collectDependencies } from './collectDependenics';
import { loadManifest } from './load/loadManifes';
import { loadMeta } from './load/loadMeta';
import { buildManifestBindings } from './manifestBinding';
import type { ScannerResult } from './types';
import { mergeMeta } from './util';

export async function scanner(config: ResolvedConfig): Promise<ScannerResult> {
	const loadedManifest = await loadManifest(config.source);
	if (!loadedManifest) {
		throw new ManifestNotFoundError(config.source.dir);
	}
	const manifestDependencies = new Set<string>(loadedManifest.dependencies);
	const moduleManifestDependencies = new Set<string>();
	const runtimeSetupFiles = new Set<string>();
	const runtimeDependencies = new Set<string>();
	for (const setupFile of config.runtime.setup) {
		if (!existsSync(setupFile)) {
			throw new RuntimeSetupNotFoundError(setupFile);
		}
		runtimeSetupFiles.add(setupFile);
		for (const dependency of collectDependencies(setupFile, { root: config.root })) {
			runtimeDependencies.add(dependency);
		}
	}
	const injectionDefaults = resolveInjectionDefaults(loadedManifest.manifest.injectionDefaults);
	const resolveManifest = resolveInjections(loadedManifest.manifest, {
		root: config.root,
		source: config.source,
		injectionDefaults
	});
	const normalizedManifestInjections = normalizeInjectionManifest(loadedManifest.manifest);
	const manifestInjectionConfigs = new Map(
		resolveManifest.map((injection, index) => [
			injection.moduleId,
			normalizedManifestInjections[index]
		])
	);

	const folder = readdirSync(config.source.dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

	const isIncluded = picomatch(config.source.include);
	const isExcluded = picomatch(config.source.exclude);
	const filteredFolders = folder.filter((name) => isIncluded(name) && !isExcluded(name));

	const injectionsMeta: ResolvedInjectionModule[] = [];
	const moduleInjectionConfigs = new Map<string, InjectionModuleConfig>();
	for (const module of filteredFolders) {
		const modulePath = path.join(config.source.dir, module);
		//check module level config
		const meta = await loadMeta(modulePath);
		if (!meta) {
			continue;
		}
		for (const dependency of meta.dependencies) {
			moduleManifestDependencies.add(dependency);
		}
		// resolve module config
		const resolveOptions = {
			root: config.root,
			source: config.source,
			injectionDefaults,
			moduleDir: modulePath,
			componentPath: path.join(modulePath, meta.moduleConfig.component),
			fallbackName: module,
			moduleManifestFile: meta.moduleManifestFile
		};
		const moduleMeta = resolveInjection(meta.moduleConfig, resolveOptions);
		const manifestConfig = manifestInjectionConfigs.get(moduleMeta.moduleId);
		const resolveMeta = resolveInjection(
			manifestConfig ? { ...manifestConfig, ...meta.moduleConfig } : meta.moduleConfig,
			resolveOptions
		);

		// module config array
		injectionsMeta.push(resolveMeta);
		moduleInjectionConfigs.set(resolveMeta.moduleId, meta.moduleConfig);
	}

	// merge target: module config
	// merge source: main config(manifest config)
	// injectionsMeta field will override resolveManifest when module id is equal
	const injections = mergeMeta(resolveManifest, injectionsMeta).filter(
		(injection) => injection.enabled
	);
	const resolvedListeners: ResolvedListener[] = resolveListeners(loadedManifest.manifest, {
		root: config.root
	});
	const listeners = resolvedListeners.filter((listener) => listener.enabled);

	if (injections.length === 0 && listeners.length === 0) {
		throw new NoEnabledTasksError();
	}

	const manifestBindings = buildManifestBindings({
		manifest: loadedManifest.manifest,
		manifestFile: loadedManifest.manifestFile,
		manifestInjections: resolveManifest,
		moduleInjections: injectionsMeta,
		moduleInjectionConfigs,
		manifestListeners: resolvedListeners,
		enabledInjections: injections,
		enabledListeners: listeners
	});

	injections.sort((a, b) => a.moduleId.localeCompare(b.moduleId));
	listeners.sort((a, b) => a.listenerId.localeCompare(b.listenerId));

	const frameworks = [...new Set(injections.map((m) => m.framework))];

	return {
		config,
		injectionDefaults,
		manifestFile: loadedManifest.manifestFile,
		manifestBindings,
		manifestDependencies: [...manifestDependencies].sort(),
		moduleManifestDependencies: [...moduleManifestDependencies].sort(),
		runtimeSetupFiles: [...runtimeSetupFiles].sort(),
		runtimeDependencies: [...runtimeDependencies].sort(),
		injections,
		listeners,
		frameworks
	};
}
