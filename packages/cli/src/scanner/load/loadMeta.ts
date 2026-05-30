import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { DEFAULT_MANIFEST_FILE_NAME } from '../../config/defaults';
import { ModuleManifestLoadError } from '../../error/error';
import type { LoadMetaResult } from '../type';
import { validateModuleMeta } from '../validation';

export async function loadMeta(root: string): Promise<LoadMetaResult | null> {
	const files = fs.readdirSync(root).filter((name) => {
		const fullPath = path.join(root, name);
		return fs.statSync(fullPath).isFile();
	});
	if (files.length === 0) {
		return null;
	}
	const jiti = createJiti(root, { moduleCache: false });
	for (const f of files) {
		const fileName: string = path.basename(f, path.extname(f));
		if (fileName === DEFAULT_MANIFEST_FILE_NAME) {
			const fullPath = path.join(root, f);

			let raw: unknown;
			try {
				raw = await jiti.import(fullPath, { default: true });
			} catch (err) {
				throw new ModuleManifestLoadError(fullPath, undefined, err instanceof Error ? err : undefined);
			}

			return {
				overridePath: fullPath,
				moduleConfig: validateModuleMeta(raw, fullPath)
			};
		}
	}

	return null;
}
