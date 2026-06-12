import path from 'node:path';
import { DEFAULT_MANIFEST_FILE_NAME } from '../config/defaults';
import type { ScannerResult } from '../scanner/types';
import type { StructuralChangeKind, WatchTargets } from './types';

export function getWatchTargets(scanResult: ScannerResult): WatchTargets {
	const { config, injections, manifestDependencies, runtimeSetupFiles, runtimeDependencies } =
		scanResult;

	const files = new Set<string>();
	const dirs = new Set<string>();

	files.add(scanResult.manifestFile);
	for (const dependency of manifestDependencies) {
		files.add(dependency);
	}
	for (const file of runtimeSetupFiles) {
		files.add(file);
	}
	for (const dependency of runtimeDependencies) {
		files.add(dependency);
	}

	// module level manifest file
	for (const injection of injections) {
		const override: string | undefined = injection.overridePath;
		if (override) {
			files.add(override);
		}
	}

	// injections/**.xx
	dirs.add(config.source.dir);

	return {
		files: [...files],
		dirs: [...dirs]
	};
}

export function isStructuralChange(changedFile: string, scanResult: ScannerResult): boolean {
	return classifyStructuralChange(changedFile, scanResult) !== null;
}

export function classifyStructuralChange(
	changedFile: string,
	scanResult: ScannerResult
): StructuralChangeKind | null {
	const { config } = scanResult;
	if (changedFile === scanResult.manifestFile) {
		return 'top-level-manifest';
	}
	if (scanResult.manifestDependencies.includes(changedFile)) {
		return 'manifest-dependency';
	}
	if (scanResult.runtimeDependencies.includes(changedFile)) {
		return 'runtime-dependency';
	}
	if (scanResult.runtimeSetupFiles.includes(changedFile)) {
		return 'runtime-setup';
	}

	const rel = path.relative(config.source.dir, changedFile);
	if (!rel.startsWith('..')) {
		const basename = path.basename(changedFile, path.extname(changedFile));
		if (basename === DEFAULT_MANIFEST_FILE_NAME) return 'module-manifest';
	}
	return null;
}
