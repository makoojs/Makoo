import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ErrorCode } from '@makoo/core';
import { createJiti } from 'jiti';
import type { ResolvedSourceConfig } from '../../config/type';
import { MakooError } from '../error';
import type { LoadManifestResult } from '../type';
import { validateManifest } from '../validation';

export async function loadManifest(
	source: ResolvedSourceConfig
): Promise<LoadManifestResult | null> {
	if (!existsSync(source.dir)) {
		throw new MakooError(
			`Source directory not found at ${source.dir}`,
			undefined,
			ErrorCode.CLI_SOURCE_DIR_NOT_FOUND
		);
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
				throw new MakooError(
					`Failed to load manifest at ${fullPath}`,
					[{ path: '(load)', message: err instanceof Error ? err.message : String(err) }],
					ErrorCode.CLI_MANIFEST_LOAD_FAIL,
					err instanceof Error ? err : undefined
				);
			}

			return {
				manifest: validateManifest(raw, fullPath),
				manifestFile: fullPath
			};
		}
	}

	return null;
}
