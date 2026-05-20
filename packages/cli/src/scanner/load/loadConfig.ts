import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createJiti } from 'jiti';
import type { CliConfig } from '../../config/type';
import type { LoadedConfig } from '../type';

const CONFIG_FILES = ['rite.config.ts', 'rite.config.js', 'rite.config.mjs', 'rite.config.cjs'];

const findConfigFile = (root: string): string | null => {
	let configFile: string | null = null;

	for (const f of CONFIG_FILES) {
		const filePath: string = path.resolve(root, f);
		if (existsSync(filePath)) {
			configFile = filePath;
			break;
		}
	}

	return configFile;
};

export async function loadConfig(): Promise<LoadedConfig> {
	const projectRoot = path.resolve(process.cwd());
	const configFile = findConfigFile(projectRoot);

	if (!configFile) {
		throw new Error(`No config file found in ${projectRoot}`);
	}

	const jiti = createJiti(projectRoot);
	const config = await jiti.import<CliConfig>(configFile, { default: true });

	return {
		config,
		riteConfigFile: configFile,
		root: projectRoot
	};
}
