import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import { resolveInjection, resolveInjections, resolveInjectorConfig } from '../config/resolve';
import type { ResolvedConfig, ResolvedInjectionModule } from '../config/types';
import {
	ManifestNotFoundError,
	NoEnabledInjectionsError,
	RuntimeSetupNotFoundError
} from '../error/error';
import { collectDependencies } from './collectDependenics';
import { loadManifest } from './load/loadManifes';
import { loadMeta } from './load/loadMeta';
import type { ScannerResult } from './types';
import { mergeMeta } from './util';

export async function scanner(config: ResolvedConfig): Promise<ScannerResult> {
	const loadedManifest = await loadManifest(config.source);
	if (!loadedManifest) {
		throw new ManifestNotFoundError(config.source.dir);
	}
	const manifestDependencies = new Set<string>(loadedManifest.dependencies);
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
	const resolveInjector = resolveInjectorConfig(loadedManifest.manifest.injectionDefaults);
	const resolveManifest = resolveInjections(loadedManifest.manifest, {
		root: config.root,
		source: config.source,
		injector: resolveInjector
	});

	const folder = readdirSync(config.source.dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

	const isIncluded = picomatch(config.source.include);
	const isExcluded = picomatch(config.source.exclude);
	const filteredFolders = folder.filter((name) => isIncluded(name) && !isExcluded(name));

	const injectionsMeta: ResolvedInjectionModule[] = [];
	for (const module of filteredFolders) {
		const modulePath = path.join(config.source.dir, module);
		//check module level config
		const meta = await loadMeta(modulePath);
		if (!meta) {
			continue;
		}
		for (const dependency of meta.dependencies) {
			manifestDependencies.add(dependency);
		}
		const resolveMeta = resolveInjection(meta.moduleConfig, {
			root: config.root,
			source: config.source,
			injector: resolveInjector,
			moduleDir: modulePath,
			componentPath: path.join(modulePath, meta.moduleConfig.component),
			fallbackName: module,
			overridePath: meta.overridePath
		});
		injectionsMeta.push(resolveMeta);
	}

	const injections = mergeMeta(resolveManifest, injectionsMeta).filter(
		(injection) => injection.enabled
	);

	if (injections.length === 0) {
		throw new NoEnabledInjectionsError();
	}

	injections.sort((a, b) => a.moduleId.localeCompare(b.moduleId));

	const frameworks = [...new Set(injections.map((m) => m.framework))];

	return {
		config,
		injector: resolveInjector,
		manifestFile: loadedManifest.manifestFile,
		manifestDependencies: [...manifestDependencies].sort(),
		runtimeSetupFiles: [...runtimeSetupFiles].sort(),
		runtimeDependencies: [...runtimeDependencies].sort(),
		injections,
		frameworks
	};
}
