import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import type { InjectionManifest, ResolvedSourceConfig } from '../../config/type';

export async function loadManifest(
	source: ResolvedSourceConfig
): Promise<InjectionManifest | null> {
	if (!existsSync(source.dir)) {
		return null;
	}
	const manifestName = source.manifest;
	const jiti = createJiti(source.dir);
	for (const entry of readdirSync(source.dir)) {
		const fullPath = path.join(source.dir, entry);
		if (
			statSync(fullPath).isFile() &&
			path.basename(entry, path.extname(entry)) === manifestName
		) {
			return jiti.import(fullPath, { default: true });
		}
	}
	return null;
}
