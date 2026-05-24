import { readdirSync } from 'node:fs';
import path from 'node:path';
import { ErrorCode } from '@makoo/core';
import picomatch from 'picomatch';
import { resolveInjection, resolveInjections, resolveInjectorConfig } from '../config/resolve';
import type { ResolvedConfig, ResolvedInjectionModule } from '../config/type';
import { MakooError } from './error';
import { loadManifest } from './load/loadManifes';
import { loadMeta } from './load/loadMeta';
import type { ScannerResult } from './type';
import { mergeMeta } from './util';

export async function scanner(config: ResolvedConfig): Promise<ScannerResult> {
	const loadedManifest = await loadManifest(config.source);
	if (!loadedManifest) {
		throw new MakooError(
			`No manifest found in source directory at ${config.source.dir}`,
			undefined,
			ErrorCode.CLI_MANIFEST_NOT_FOUND
		);
	}
	const resolveInjector = resolveInjectorConfig(loadedManifest.manifest.globalInjector);
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
		const resolveMeta = resolveInjection(meta.moduleConfig, {
			root: config.root,
			source: config.source,
			injector: resolveInjector,
			moduleDir: modulePath,
			fallbackName: module,
			overridePath: meta.overridePath
		});
		injectionsMeta.push(resolveMeta);
	}

	const injections = mergeMeta(resolveManifest, injectionsMeta).filter(
		(injection) => injection.enabled
	);

	if (injections.length === 0) {
		throw new MakooError(
			'No enabled injections — all injections are disabled or filtered out',
			undefined,
			ErrorCode.CLI_NO_ENABLED_INJECTIONS
		);
	}

	injections.sort((a, b) => a.moduleId.localeCompare(b.moduleId));

	const frameworks = [...new Set(injections.map((m) => m.framework))];

	return {
		config: { ...config, injector: resolveInjector },
		manifestFile: loadedManifest.manifestFile,
		injections,
		frameworks
	};
}
