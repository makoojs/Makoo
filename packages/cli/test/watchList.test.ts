import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config/resolve';
import type { ResolvedInjectionModule } from '../src/config/types';
import type { ScannerResult } from '../src/scanner/types';
import { getWatchTargets, isStructuralChange } from '../src/vitePlugin/watchList';

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

const scanResult: ScannerResult = {
	config,
	manifestFile,
	manifestDependencies: [path.join(sourceDir, 'hooks.ts')],
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

		expect(targets.files).toEqual([manifestFile, path.join(sourceDir, 'hooks.ts'), moduleManifestFile]);
		expect(targets.dirs).toEqual([sourceDir]);
	});

	it('detects structural changes for manifest files and manifest dependencies', () => {
		expect(isStructuralChange(manifestFile, scanResult)).toBe(true);
		expect(isStructuralChange(moduleManifestFile, scanResult)).toBe(true);
		expect(isStructuralChange(path.join(sourceDir, 'hooks.ts'), scanResult)).toBe(true);
		expect(isStructuralChange(path.join(sourceDir, 'widget/App.tsx'), scanResult)).toBe(false);
		expect(isStructuralChange(path.join(root, 'outside/manifest.ts'), scanResult)).toBe(false);
	});
});
