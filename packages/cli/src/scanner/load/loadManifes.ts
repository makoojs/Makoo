import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import type { ResolvedSourceConfig } from '../../config/type';
import { ManifestLoadError, SourceDirNotFoundError } from '../../error/error';
import type { LoadManifestResult } from '../type';
import { validateManifest } from '../validation';

export async function loadManifest(
	source: ResolvedSourceConfig
): Promise<LoadManifestResult | null> {
	if (!existsSync(source.dir)) {
		throw new SourceDirNotFoundError(source.dir);
	}

	const manifestName = source.manifest;
	const jiti = createJiti(source.dir, { moduleCache: false });

	for (const entry of readdirSync(source.dir)) {
		const fullPath = path.join(source.dir, entry);
		if (
			statSync(fullPath).isFile() &&
			path.basename(entry, path.extname(entry)) === manifestName
		) {
			let raw: unknown;
			try {
				raw = await jiti.import(fullPath, { default: true });
			} catch (err) {
				throw new ManifestLoadError(fullPath, undefined, err instanceof Error ? err : undefined);
			}

			return {
				manifest: validateManifest(raw, fullPath),
				manifestFile: fullPath
			};
		}
	}

	return null;
}
