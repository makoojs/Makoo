import {
	basename,
	dirname,
	extname,
	isAbsolute,
	normalize,
	resolve as resolvePath
} from 'node:path';
import process from 'node:process';
import type { MonkeyOption } from 'vite-plugin-monkey';
import { ComponentNotFoundError, UnknownFrameworkError } from '../error/error';
import {
	DEFAULT_FILE_NAME_SUFFIX,
	DEFAULT_INJECTOR_CONFIG,
	DEFAULT_MANIFEST_FILE_NAME,
	DEFAULT_MONKEY_BUILD_CONFIG,
	DEFAULT_MONKEY_CONFIG,
	DEFAULT_MONKEY_SERVER_CONFIG,
	DEFAULT_SOURCE_CONFIG,
	FAKE_ENTRY,
	REACT_EXTENSIONS,
	VUE_EXTENSIONS
} from './defaults';
import type {
	AppConfig,
	CliConfig,
	InjectionFramework,
	InjectionManifest,
	InjectionMatchConfig,
	InjectionMatchObject,
	InjectionModuleConfig,
	InjectorConfig,
	MonkeyBuildConfig,
	MonkeyConfig,
	MonkeyUserscriptOption,
	ResolveConfigOptions,
	ResolvedConfig,
	ResolvedInjectionFramework,
	ResolvedInjectionManifest,
	ResolvedInjectionModule,
	ResolvedInjectorConfig,
	ResolvedMonkeyBuildConfig,
	ResolvedMonkeyConfig,
	ResolvedMonkeyServerConfig,
	ResolvedSourceConfig,
	ResolveInjectionOptions,
	SourceConfig
} from './type';
import { validateCliConfig } from './validation';

const toStringArray = (value: string | string[] | undefined, fallback: string[]): string[] => {
	if (Array.isArray(value)) {
		return value;
	}

	if (typeof value === 'undefined') {
		return fallback;
	}

	return [value];
};

const resolveFileSystemPath = (root: string, value: string): string => {
	if (isAbsolute(value)) {
		return normalize(value);
	}

	return normalize(resolvePath(root, value));
};

const resolveProjectRoot = (root?: string): string => {
	return normalize(root ? resolvePath(root) : process.cwd());
};

const inferFrameworkFromPath = (componentPath: string): ResolvedInjectionFramework => {
	const extension = extname(componentPath).toLowerCase();

	if (REACT_EXTENSIONS.has(extension)) {
		return 'React';
	}

	if (VUE_EXTENSIONS.has(extension)) {
		return 'Vue';
	}

	throw new UnknownFrameworkError(componentPath);
};

const resolveFramework = (
	framework: InjectionFramework | undefined,
	componentPath: string
): ResolvedInjectionFramework => {
	if (framework && framework !== 'auto') {
		return framework;
	}

	return inferFrameworkFromPath(componentPath);
};

const resolveMatchConfig = (
	match: InjectionMatchConfig | undefined
): InjectionMatchObject | undefined => {
	if (!match) {
		return undefined;
	}

	if (Array.isArray(match)) {
		return {
			include: match
		};
	}

	return {
		include: match.include,
		exclude: match.exclude
	};
};

const deriveInjectionModuleId = (
	config: InjectionModuleConfig,
	moduleDir: string,
	componentPath: string,
	fallbackName?: string,
	index?: number
): string => {
	if (config.name) {
		return config.name;
	}

	if (fallbackName) {
		return fallbackName;
	}

	const moduleName = basename(moduleDir);
	if (moduleName) {
		return moduleName;
	}

	const componentName = basename(componentPath, extname(componentPath));
	if (componentName) {
		return componentName;
	}

	return `injection-${typeof index === 'number' ? index + 1 : 1}`;
};

const resolveMetaFileName = (
	fileName: string,
	metaFileName: MonkeyBuildConfig['metaFileName']
): string | false => {
	if (metaFileName === false || typeof metaFileName === 'undefined') {
		return false;
	}

	if (metaFileName === true) {
		return fileName.replace(/\.user\.js$/, '.meta.js');
	}

	if (typeof metaFileName === 'function') {
		return metaFileName(fileName);
	}

	return metaFileName;
};
const normalizeMonkeyLocaleValue = <T>(value: T): T | Record<string, string> => {
	if (typeof value === 'string') {
		return { '': value };
	}
	return value;
};

const normalizeMonkeyUserscript = (userscript: MonkeyUserscriptOption): MonkeyUserscriptOption => {
	return {
		...userscript,
		name: normalizeMonkeyLocaleValue(userscript.name),
		description: normalizeMonkeyLocaleValue(userscript.description)
	} as MonkeyUserscriptOption;
};

export const normalizeInjectionManifest = (
	injections: InjectionManifest | undefined
): ResolvedInjectionManifest => {
	const items = injections?.injections;
	if (!items) {
		return [];
	}
	if (Array.isArray(items)) {
		return items;
	}
	return Object.entries(items).map(([name, config]) => ({
		name,
		...config
	}));
};

export const resolveAppConfig = (config: AppConfig): AppConfig => {
	return {
		name: config.name,
		version: config.version,
		description: config.description
	};
};

export const resolveSourceConfig = (
	config: SourceConfig | undefined,
	root: string
): ResolvedSourceConfig => {
	return {
		dir: resolveFileSystemPath(root, DEFAULT_SOURCE_CONFIG.dir),
		include: toStringArray(config?.include, DEFAULT_SOURCE_CONFIG.include),
		exclude: toStringArray(config?.exclude, DEFAULT_SOURCE_CONFIG.exclude),
		manifest: DEFAULT_MANIFEST_FILE_NAME
	};
};

export const resolveInjectorConfig = (
	config: InjectorConfig | undefined
): ResolvedInjectorConfig => {
	return {
		alive: config?.alive ?? DEFAULT_INJECTOR_CONFIG.alive,
		scope: config?.scope ?? DEFAULT_INJECTOR_CONFIG.scope,
		timeout: config?.timeout ?? DEFAULT_INJECTOR_CONFIG.timeout,
		hooks: config?.hooks
	};
};

export const resolveMonkeyServerConfig = (
	config: MonkeyConfig | undefined
): ResolvedMonkeyServerConfig => {
	return {
		open: config?.server?.open ?? DEFAULT_MONKEY_SERVER_CONFIG.open,
		prefix: config?.server?.prefix ?? DEFAULT_MONKEY_SERVER_CONFIG.prefix,
		mountGmApi: config?.server?.mountGmApi ?? DEFAULT_MONKEY_SERVER_CONFIG.mountGmApi
	};
};

export const resolveMonkeyBuildConfig = (
	app: AppConfig,
	config: MonkeyConfig | undefined
): ResolvedMonkeyBuildConfig => {
	const fileName = config?.build?.fileName ?? `${app.name}${DEFAULT_FILE_NAME_SUFFIX}`;

	return {
		fileName,
		metaFileName: resolveMetaFileName(
			fileName,
			config?.build?.metaFileName ?? DEFAULT_MONKEY_BUILD_CONFIG.metaFileName
		),
		externalGlobals: config?.build?.externalGlobals,
		autoGrant: config?.build?.autoGrant ?? DEFAULT_MONKEY_BUILD_CONFIG.autoGrant,
		externalResource: config?.build?.externalResource,
		systemjs: config?.build?.systemjs,
		cssSideEffects: config?.build?.cssSideEffects
	};
};

export const resolveMonkeyConfig = (
	app: AppConfig,
	config: MonkeyConfig | undefined
): ResolvedMonkeyConfig => {
	const {
		userscript,
		align,
		clientAlias,
		styleImport,
		server: _server,
		build: _build,
		...rest
	} = config ?? {};
	void _server;
	void _build;

	return {
		...rest,
		userscript: {
			name: app.name,
			version: app.version,
			description: app.description,
			...userscript
		},
		align: align ?? DEFAULT_MONKEY_CONFIG.align ?? 2,
		clientAlias: clientAlias ?? DEFAULT_MONKEY_CONFIG.clientAlias ?? '$',
		styleImport: styleImport ?? DEFAULT_MONKEY_CONFIG.styleImport ?? true,
		server: resolveMonkeyServerConfig(config),
		build: resolveMonkeyBuildConfig(app, config)
	};
};

export const resolveInjection = (
	config: InjectionModuleConfig,
	options: ResolveInjectionOptions
): ResolvedInjectionModule => {
	const root = resolveProjectRoot(options.root);
	const source = options.source ?? resolveSourceConfig(undefined, root);
	const injector = options.injector ?? resolveInjectorConfig(undefined);
	const componentBaseDir = options.moduleDir
		? resolveFileSystemPath(root, options.moduleDir)
		: source.dir;
	if (!options.componentPath) {
		throw new ComponentNotFoundError(config.name ?? config.injectAt);
	}
	const componentPath = resolveFileSystemPath(root, options.componentPath);
	const moduleDir = options.moduleDir
		? componentBaseDir
		: componentPath
			? dirname(componentPath)
			: source.dir;

	const {
		component,
		framework: _framework,
		enabled: _enabled,
		alive: _alive,
		scope: _scope,
		timeout: _timeout,
		...rest
	} = config;
	void component;
	void _framework;
	void _enabled;
	void _alive;
	void _scope;
	void _timeout;

	const moduleId =
		options.moduleId ??
		deriveInjectionModuleId(
			config,
			moduleDir,
			componentPath,
			options.fallbackName,
			options.index
		);
	const framework = resolveFramework(config.framework, componentPath);
	const overridePath = options.overridePath
		? resolveFileSystemPath(root, options.overridePath)
		: undefined;

	return {
		...rest,
		moduleId,
		componentPath,
		framework,
		moduleDir,
		overridePath,
		enabled: config.enabled ?? true,
		alive: config.alive ?? injector.alive,
		scope: config.scope ?? injector.scope,
		timeout: config.timeout ?? injector.timeout,
		match: resolveMatchConfig(config.match)
	};
};

export const resolveInjections = (
	injections: InjectionManifest | undefined,
	options: ResolveConfigOptions & {
		source: ResolvedSourceConfig;
		injector: ResolvedInjectorConfig;
	}
): ResolvedInjectionModule[] => {
	const root = resolveProjectRoot(options.root);
	const normalizedInjections = normalizeInjectionManifest(injections);

	return normalizedInjections.map((injection, index) =>
		resolveInjection(injection, {
			root,
			source: options.source,
			injector: options.injector,
			componentPath: resolvePath(options.source.dir, injection.component),
			// `index` was a name of element
			index
		})
	);
};

export const resolveConfig = (config: CliConfig, root: string = process.cwd()): ResolvedConfig => {
	validateCliConfig(config);

	const projectRoot = resolveProjectRoot(root);
	const app = resolveAppConfig(config.app);
	const source = resolveSourceConfig(config.source, root);
	const injector = resolveInjectorConfig(config.injector);
	const monkey = resolveMonkeyConfig(app, config.monkey);

	return {
		root: projectRoot,
		app,
		monkey,
		source,
		injector
	};
};

export function resolveMonkeyPluginOptions(
	config: ResolvedConfig,
	override?: Partial<MonkeyOption>
): MonkeyOption {
	const resolved: MonkeyOption = {
		...config.monkey,
		entry: `./${FAKE_ENTRY}`,
		userscript: config.monkey.userscript,
		align: config.monkey.align,
		generate: config.monkey.generate,
		clientAlias: config.monkey.clientAlias,
		styleImport: config.monkey.styleImport,
		server: config.monkey.server,
		build: config.monkey.build
	};

	return {
		...resolved,
		...override,
		entry: `./${FAKE_ENTRY}`,
		userscript: normalizeMonkeyUserscript({
			...resolved.userscript,
			...override?.userscript
		}),
		server: {
			...resolved.server,
			...override?.server
		},
		build: {
			...resolved.build,
			...override?.build
		}
	};
}
