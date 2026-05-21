import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import type { ResolvedSourceConfig } from '../../config/type';
import type { LoadManifestResult } from '../type';

export async function loadManifest(
	source: ResolvedSourceConfig
): Promise<LoadManifestResult | null> {
	if (!existsSync(source.dir)) {
		return null;
	}
	const manifestName = source.manifest;
	const jiti = createJiti(source.dir, { moduleCache: false });
	for (const entry of readdirSync(source.dir)) {
		const fullPath = path.join(source.dir, entry);
		if (
			statSync(fullPath).isFile() &&
			path.basename(entry, path.extname(entry)) === manifestName
		) {
			return {
				manifest: await jiti.import(fullPath, { default: true }),
				manifestFile: fullPath
			};
		}
	}
	return null;
}
