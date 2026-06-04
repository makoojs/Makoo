import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_SOURCE_DIR } from '../config/defaults';
import { ModuleAlreadyExistsError, UnsupportedFrameworkGenerationError } from '../error/error';
import { getExtName, moduleTemplate, updateManifest } from './_util';

export async function addCommand(moduleName: string, framework: string): Promise<void> {
	const cwd: string = process.cwd();
	const sourceDir = join(cwd, DEFAULT_SOURCE_DIR);
	const moduleDir: string = join(sourceDir, moduleName);
	const extName: string | null = getExtName(framework);
	if (!extName) throw new UnsupportedFrameworkGenerationError(framework);

	const appPath: string = join(moduleDir, `App${extName}`);

	//To prevent subsequent writes from overwriting fields with the same name.
	if (existsSync(moduleDir)) {
		throw new ModuleAlreadyExistsError(`Module "${moduleName}" already exists`);
	}

	await mkdir(moduleDir, { recursive: true });

	await writeFile(appPath, moduleTemplate(framework));

	await updateManifest(moduleName, {
		injectAt: 'body',
		component: `./${moduleName}/app${extName}`
	});
}
