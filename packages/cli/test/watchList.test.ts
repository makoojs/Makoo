import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config/resolve';
import type { ResolvedInjectionModule } from '../src/config/types';
import type { ScannerResult } from '../src/scanner/types';
import {
	classifyStructuralChange,
	getWatchTargets,
	isStructuralChange
} from '../src/vitePlugin/watchList';

const root = path.resolve('/project');
const config = resolveConfig(
	{
		app: { name: 'watch-list', version: '0.0.1' }
	},
	root
);
const sourceDir = path.join(root, 'injections');
const manifestFile = path.join(sourceDir, 'manifest.ts');
const moduleManifestFile = path.join(sourceDir, 'widget/manifest.ts');
const runtimeSetupFile = path.join(sourceDir, 'vue-setup.ts');
const runtimeDependencyFile = path.join(sourceDir, 'router.ts');

const scanResult: ScannerResult = {
	config,
	injector: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	manifestFile,
	manifestDependencies: [path.join(sourceDir, 'hooks.ts')],
	runtimeSetupFiles: [runtimeSetupFile],
	runtimeDependencies: [runtimeDependencyFile],
	injections: [
		{ overridePath: moduleManifestFile },
		{ overridePath: moduleManifestFile },
		{}
	] as ResolvedInjectionModule[],
	frameworks: ['React']
};

describe('watchList', () => {
	it('collects top-level manifest, module manifests and source directory as watch targets', () => {
		const targets = getWatchTargets(scanResult);

		expect(targets.files).toEqual([
			manifestFile,
			path.join(sourceDir, 'hooks.ts'),
			runtimeSetupFile,
			runtimeDependencyFile,
			moduleManifestFile
		]);
		expect(targets.dirs).toEqual([sourceDir]);
	});

	it('detects structural changes for manifest files, manifest dependencies and runtime files', () => {
		expect(isStructuralChange(manifestFile, scanResult)).toBe(true);
		expect(isStructuralChange(moduleManifestFile, scanResult)).toBe(true);
		expect(isStructuralChange(path.join(sourceDir, 'hooks.ts'), scanResult)).toBe(true);
		expect(isStructuralChange(runtimeSetupFile, scanResult)).toBe(true);
		expect(isStructuralChange(runtimeDependencyFile, scanResult)).toBe(true);
		expect(isStructuralChange(path.join(sourceDir, 'widget/App.tsx'), scanResult)).toBe(false);
		expect(isStructuralChange(path.join(root, 'outside/manifest.ts'), scanResult)).toBe(false);
	});

	it('classifies structural change reasons', () => {
		expect(classifyStructuralChange(manifestFile, scanResult)).toBe('top-level-manifest');
		expect(classifyStructuralChange(moduleManifestFile, scanResult)).toBe('module-manifest');
		expect(
			classifyStructuralChange(path.join(sourceDir, 'new-widget/manifest.ts'), scanResult)
		).toBe('module-manifest');
		expect(classifyStructuralChange(path.join(sourceDir, 'hooks.ts'), scanResult)).toBe(
			'manifest-dependency'
		);
		expect(classifyStructuralChange(runtimeSetupFile, scanResult)).toBe('runtime-setup');
		expect(classifyStructuralChange(runtimeDependencyFile, scanResult)).toBe(
			'runtime-dependency'
		);
		expect(
			classifyStructuralChange(path.join(sourceDir, 'widget/App.tsx'), scanResult)
		).toBeNull();
	});
});
