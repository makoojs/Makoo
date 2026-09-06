#!/usr/bin/env node
import { MakooError } from '@makoojs/core';
import cac from 'cac';
import type { BuildOptions, InlineConfig, ServerOptions } from 'vite';
import { buildCommand } from './commands/build';
import { devCommand } from './commands/dev/dev';
import { previewCommand } from './commands/preview';
import { loadCliVersion } from './version';

const cli = cac('makoo');

type CommonOptions = Pick<InlineConfig, 'mode' | 'logLevel' | 'clearScreen' | 'configLoader'> & {
	config?: string;
	base?: string | number;
};

type ServerCommandOptions = Pick<ServerOptions, 'port' | 'open' | 'strictPort'> & {
	host?: string | boolean | number;
};

type DevCommandOptions = CommonOptions &
	ServerCommandOptions &
	Pick<ServerOptions, 'cors'> & { force?: boolean };

type BuildCommandOptions = CommonOptions &
	Pick<
		BuildOptions,
		| 'target'
		| 'outDir'
		| 'assetsDir'
		| 'assetsInlineLimit'
		| 'minify'
		| 'manifest'
		| 'emptyOutDir'
	> & {
		sourcemap?: BuildOptions['sourcemap'] | 'true' | 'false';
		watch?: boolean;
	};

function normalizeDuplicateOptions(options: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(options)) {
		if (Array.isArray(value)) options[key] = value[value.length - 1];
	}
}

function resolveCommonOptions(root: string | undefined, options: CommonOptions): InlineConfig {
	return {
		root,
		configFile: options.config,
		base:
			options.base === 0 ? '' : options.base === undefined ? undefined : String(options.base),
		mode: options.mode,
		logLevel: options.logLevel,
		clearScreen: options.clearScreen,
		configLoader: options.configLoader
	};
}

cli.option('-c, --config <file>', 'Use specified Vite config file')
	.option('-m, --mode <mode>', 'Set environment mode')
	.option('--base <path>', 'Public base path')
	.option('-l, --logLevel <level>', 'Log level: info | warn | error | silent')
	.option('--clearScreen', 'Allow/disable clearing the terminal')
	.option('--configLoader <loader>', 'Config loader: bundle | runner | native');

cli.command('build [root]', 'Build the userscript')
	.option('--target <target>', 'Transpile target')
	.option('--outDir <dir>', 'Output directory')
	.option('--assetsDir <dir>', 'Directory for generated assets')
	.option('--assetsInlineLimit <number>', 'Asset inline threshold in bytes')
	.option('--sourcemap [output]', 'Source maps: true | false | inline | hidden')
	.option('--minify [minifier]', 'Enable/disable minification, or select a minifier')
	.option('--manifest [name]', 'Emit a build manifest')
	.option('--emptyOutDir', 'Allow/disable emptying the output directory')
	.option('-w, --watch', 'Rebuild when source files change')
	.action(async (root: string | undefined, options: BuildCommandOptions) => {
		normalizeDuplicateOptions(options);
		let sourcemap = options.sourcemap;
		if (sourcemap === 'true') sourcemap = true;
		if (sourcemap === 'false') sourcemap = false;
		await buildCommand({
			...resolveCommonOptions(root, options),
			build: {
				target: options.target,
				outDir: options.outDir,
				assetsDir: options.assetsDir,
				assetsInlineLimit: options.assetsInlineLimit,
				sourcemap,
				minify: options.minify,
				manifest: options.manifest,
				emptyOutDir: options.emptyOutDir,
				watch: options.watch ? {} : undefined
			}
		});
	});

cli.command('dev [root]', 'Start the dev server')
	.option('--host [host]', 'Listen on a hostname or all addresses')
	.option('--port <port>', 'Development server port')
	.option('--open [path]', 'Open the browser on startup')
	.option('--cors', 'Enable/disable CORS')
	.option('--strictPort', 'Exit if the requested port is in use')
	.option('--force', 'Ignore the dependency optimizer cache')
	.action(async (root: string | undefined, options: DevCommandOptions) => {
		normalizeDuplicateOptions(options);
		await devCommand({
			...resolveCommonOptions(root, options),
			server: {
				host: typeof options.host === 'number' ? String(options.host) : options.host,
				port: options.port,
				open: options.open,
				cors: options.cors,
				strictPort: options.strictPort
			},
			forceOptimizeDeps: options.force
		});
	});

cli.command('preview [root]', 'Preview the built userscript')
	.option('--host [host]', 'Listen on a hostname or all addresses')
	.option('--port <port>', 'Preview server port')
	.option('--open [path]', 'Open the browser on startup')
	.option('--strictPort', 'Exit if the requested port is in use')
	.option('--outDir <dir>', 'Directory to preview')
	.action(
		async (
			root: string | undefined,
			options: CommonOptions & ServerCommandOptions & { outDir?: string }
		) => {
			normalizeDuplicateOptions(options);
			await previewCommand({
				...resolveCommonOptions(root, options),
				build: { outDir: options.outDir },
				preview: {
					host: typeof options.host === 'number' ? String(options.host) : options.host,
					port: options.port,
					open: options.open,
					strictPort: options.strictPort
				}
			});
		}
	);

cli.help();
cli.version(await loadCliVersion(null));

process.on('unhandledRejection', (err) => {
	if (err instanceof MakooError) {
		console.error(err);
	} else {
		console.error('[makoo]', err);
	}
	process.exit(1);
});

cli.parse();
