import path from 'node:path';
import { DEFAULT_MANIFEST_FILE_NAME } from '../config/defaults';
import type { ScannerResult } from '../scanner/types';
import type { WatchTargets } from './types';

export function getWatchTargets(scanResult: ScannerResult): WatchTargets {
	const { config, injections, manifestDependencies } = scanResult;

	const files = new Set<string>();
	const dirs = new Set<string>();

	files.add(scanResult.manifestFile);
	for (const dependency of manifestDependencies) {
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
	const { config } = scanResult;
	if (changedFile === scanResult.manifestFile) return true;
	if (scanResult.manifestDependencies.includes(changedFile)) return true;

	const rel = path.relative(config.source.dir, changedFile);
	if (!rel.startsWith('..')) {
		const basename = path.basename(changedFile, path.extname(changedFile));
		if (basename === DEFAULT_MANIFEST_FILE_NAME) return true;
	}
	return false;
}
