import { isAbsolute, normalize, resolve as resolvePath } from 'node:path';
import process from 'node:process';
import type { MonkeyOption } from 'vite-plugin-monkey';
import {
	DEFAULT_FILE_NAME_SUFFIX,
	DEFAULT_MONKEY_BUILD_CONFIG,
	DEFAULT_MONKEY_CONFIG,
	DEFAULT_MONKEY_SERVER_CONFIG
} from './defaults';
import type {
	AppConfig,
	CliConfig,
	MonkeyBuildConfig,
	MonkeyConfig,
	MonkeyUserscriptOption,
	ResolvedMakooConfig,
	ResolvedMonkeyBuildConfig,
	ResolvedMonkeyConfig,
	ResolvedMonkeyServerConfig
} from './types';
import { validateCliConfig } from './validation';

const resolveFileSystemPath = (root: string, value: string): string =>
	isAbsolute(value) ? normalize(value) : normalize(resolvePath(root, value));

const resolveProjectRoot = (root?: string): string =>
	normalize(root ? resolvePath(root) : process.cwd());

const normalizeMonkeyLocaleValue = <T>(value: T): T | Record<string, string> =>
	typeof value === 'string' ? { '': value } : value;

const normalizeMonkeyUserscript = (userscript: MonkeyUserscriptOption): MonkeyUserscriptOption =>
	({
		...userscript,
		name: normalizeMonkeyLocaleValue(userscript.name),
		description: normalizeMonkeyLocaleValue(userscript.description)
	}) as MonkeyUserscriptOption;

const resolveMetaFileName = (
	fileName: string,
	metaFileName: MonkeyBuildConfig['metaFileName']
): string | false => {
	if (metaFileName === false || typeof metaFileName === 'undefined') return false;
	if (metaFileName === true) return fileName.replace(/\.user\.js$/, '.meta.js');
	if (typeof metaFileName === 'function') return metaFileName(fileName);
	return metaFileName;
};

export const resolveAppConfig = (config: AppConfig): AppConfig => ({
	name: config.name,
	version: config.version,
	description: config.description
});

export const resolveMonkeyServerConfig = (config: MonkeyConfig): ResolvedMonkeyServerConfig => ({
	open: config.server?.open ?? DEFAULT_MONKEY_SERVER_CONFIG.open,
	prefix: config.server?.prefix ?? DEFAULT_MONKEY_SERVER_CONFIG.prefix,
	mountGmApi: DEFAULT_MONKEY_SERVER_CONFIG.mountGmApi
});

export const resolveMonkeyBuildConfig = (
	app: AppConfig,
	config: MonkeyConfig
): ResolvedMonkeyBuildConfig => {
	const fileName = config.build?.fileName ?? `${app.name}${DEFAULT_FILE_NAME_SUFFIX}`;

	return {
		fileName,
		metaFileName: resolveMetaFileName(
			fileName,
			config.build?.metaFileName ?? DEFAULT_MONKEY_BUILD_CONFIG.metaFileName
		),
		externalGlobals: config.build?.externalGlobals,
		autoGrant: config.build?.autoGrant ?? DEFAULT_MONKEY_BUILD_CONFIG.autoGrant,
		externalResource: config.build?.externalResource,
		systemjs: config.build?.systemjs,
		cssSideEffects: config.build?.cssSideEffects
	};
};

export const resolveMonkeyConfig = (app: AppConfig, config: MonkeyConfig): ResolvedMonkeyConfig => {
	const { userscript, align, styleImport, server: _server, build: _build, ...rest } = config;

	return {
		...rest,
		userscript: {
			...userscript,
			name: app.name,
			version: app.version,
			description: app.description
		},
		align: align ?? DEFAULT_MONKEY_CONFIG.align,
		styleImport: styleImport ?? DEFAULT_MONKEY_CONFIG.styleImport,
		server: resolveMonkeyServerConfig(config),
		build: resolveMonkeyBuildConfig(app, config)
	};
};

export const resolveConfig = (config: CliConfig, root?: string): ResolvedMakooConfig => {
	validateCliConfig(config);

	const projectRoot = resolveProjectRoot(root);
	const app = resolveAppConfig(config.app);

	return {
		root: projectRoot,
		entry: resolveFileSystemPath(projectRoot, config.entry),
		app,
		monkey: resolveMonkeyConfig(app, config.monkey)
	};
};

export const resolveMonkeyPluginOptions = (config: ResolvedMakooConfig): MonkeyOption => ({
	...config.monkey,
	entry: config.entry,
	userscript: normalizeMonkeyUserscript(config.monkey.userscript),
	server: { ...config.monkey.server },
	build: { ...config.monkey.build }
});
