import process from 'node:process';
import { ErrorCode } from '@makoo/core';
import { loadConfigFromFile } from 'vite';
import type { ResolvedConfig } from '../config/type';
import { LoadViteMakooConfigError } from '../error/error';
import { scanner } from '../scanner/scanner';
import type { ScannerResult } from '../scanner/type';
import type { MakooMonkeyPlugin } from '../vitePlugin/type';

export async function loadMakooConfig(): Promise<ResolvedConfig> {
	const root = process.cwd();
	const result = await loadConfigFromFile(
		{ command: 'build', mode: 'production' },
		undefined,
		root
	);

	if (!result) {
		throw new LoadViteMakooConfigError(
			`No vite config file found in "${root}". Make sure a vite.config.ts (or .js/.mts) exists.`,
			ErrorCode.CLI_VITE_CONFIG_NOT_FOUND
		);
	}

	const plugins = (result.config.plugins ?? [])
		.flat()
		.filter((p): p is NonNullable<typeof p> => p != null && p !== false);

	const makooPlugin = plugins.find(
		(p) => (p as { name?: string }).name === 'vite-plugin-makoo'
	) as MakooMonkeyPlugin | undefined;

	if (!makooPlugin) {
		throw new LoadViteMakooConfigError(
			`makoo plugin not found in vite config at "${result.path}". Make sure makoo() is included in your plugins array.`,
			ErrorCode.CLI_PLUGIN_NOT_FOUND
		);
	}

	return makooPlugin.__makoo;
}

export async function inspectCommand() {
	const resolveViteMakooConfig: ResolvedConfig = await loadMakooConfig();
	const resolveManifest: ScannerResult = await scanner(resolveViteMakooConfig);

	console.log('resolveViteMakooConfig:', resolveViteMakooConfig);
	console.log('resolveManifest:', resolveManifest);
}
