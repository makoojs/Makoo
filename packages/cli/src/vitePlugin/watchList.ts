import path from 'node:path';
import { META_FILE_NAME } from 'src/config/defaults';
import type { ScannerResult } from 'src/scanner/type';
import type { WatchTargets } from './type';

export function getWatchTargets(scanResult: ScannerResult, riteConfigFile: string): WatchTargets {
	const { config, injections } = scanResult;

	const files = new Set<string>();
	const dirs = new Set<string>();

	// rite.config.ts : framwork level config file
	files.add(riteConfigFile);

	// module level meta config file
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

export function isStructuralChange(
	changedFile: string,
	scanResult: ScannerResult,
	configFile: string
): boolean {
	const { config } = scanResult;
	if (changedFile === configFile) return true;

	const rel = path.relative(config.source.dir, changedFile);
	if (!rel.startsWith('..')) {
		const basename = path.basename(changedFile, path.extname(changedFile));
		if (basename === META_FILE_NAME) return true;
	}
	return false;
}
