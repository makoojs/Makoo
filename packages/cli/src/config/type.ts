import type {
	ArtifactOptions,
	LifecycleHookMap,
	InjectionConfig as RuntimeInjectionConfig
} from '@makoo/core';
import type { MonkeyOption, MonkeyUserScript } from 'vite-plugin-monkey';

export type StrictShape<Shape, Value extends Shape> = Value &
	Record<Exclude<keyof Value, keyof Shape>, never>;
export type Thenable<T> = T | Promise<T>;

export type MonkeyMode = 'serve' | 'build' | 'meta';

export type MonkeyGenerateContext = {
	userscript: string;
	mode: MonkeyMode;
};

export type MonkeyServerConfig = {
	open?: boolean;
	prefix?: string | ((name: string) => string) | false;
	mountGmApi?: boolean;
};

export type MonkeyBuildConfig = {
	fileName?: string;
	metaFileName?: string | boolean | ((fileName: string) => string);
	autoGrant?: boolean;
	systemjs?:
		| 'inline'
		| ((
				version: string,
				packageName: string,
				importName?: string,
				resolveName?: string
		  ) => string);
	cssSideEffects?: string | ((css: string) => void);
};

export type MonkeyConfig = {
	userscript?: MonkeyUserScript;
	align?: number | false;
	generate?: (options: MonkeyGenerateContext) => Thenable<string>;
	clientAlias?: string;
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};

export type AppConfig = {
	name: string;
	version: string;
	description?: string;
};

// consider to how to move the other object inside
export type SourceConfig = {
	include?: string[];
	exclude?: string[];
};

export type ResolvedSourceConfig = {
	dir: string; // Injected Components Directory
	include: string[];
	exclude: string[];
	manifest: string; // manifest file basename (no extension), e.g. 'manifest'
};

export type InjectorConfig = Partial<
	Pick<RuntimeInjectionConfig, 'alive' | 'scope' | 'timeout' | 'hooks'>
>;

export type ResolvedInjectorConfig = Pick<RuntimeInjectionConfig, 'alive' | 'scope' | 'timeout'> & {
	hooks?: LifecycleHookMap;
};

export type InjectionFramework = 'auto' | 'Vue' | 'React';

export type ResolvedInjectionFramework = Exclude<InjectionFramework, 'auto'>;

export type InjectionModuleConfig = ArtifactOptions & {
	name?: string;
	injectAt: string;
	component: string;
	framework?: InjectionFramework;
	enabled?: boolean;
	//TODO url match alive component
};

export type InjectionManifestRecord = Record<string, Omit<InjectionModuleConfig, 'name'>>;
export type InjectionManifest = {
	globalInjector?: InjectorConfig;
	injections: InjectionModuleConfig[] | InjectionManifestRecord;
};

export type ResolvedInjectionManifest = InjectionModuleConfig[];

export type ResolvedInjectionModule = Omit<
	InjectionModuleConfig,
	'name' | 'component' | 'framework' | 'enabled' | 'alive' | 'scope' | 'timeout'
> & {
	moduleId: string;
	componentPath: string;
	framework: ResolvedInjectionFramework;
	moduleDir: string;
	overridePath?: string;
	enabled: boolean;
	alive: ResolvedInjectorConfig['alive'];
	scope: ResolvedInjectorConfig['scope'];
	timeout: ResolvedInjectorConfig['timeout'];
};

export type ResolvedMonkeyServerConfig = {
	open: boolean;
	prefix: string | ((name: string) => string) | false;
	mountGmApi: boolean;
};

export type ResolvedMonkeyBuildConfig = {
	fileName: string;
	metaFileName: string | false;
	autoGrant: boolean;
	systemjs?: MonkeyBuildConfig['systemjs'];
	cssSideEffects?: MonkeyBuildConfig['cssSideEffects'];
};

export type ResolvedMonkeyConfig = Omit<
	MonkeyConfig,
	'userscript' | 'align' | 'clientAlias' | 'styleImport' | 'server' | 'build'
> & {
	userscript: MonkeyUserScript;
	align: number | false;
	clientAlias: string;
	styleImport: boolean;
	server: ResolvedMonkeyServerConfig;
	build: ResolvedMonkeyBuildConfig;
};

// config type
export type CliConfig = {
	app: AppConfig;
	monkey?: MonkeyConfig;
	source?: SourceConfig;
	injector?: InjectorConfig;
};
// CliConfig -> ResolvedConfig
//resolved config type
export type ResolvedConfig = {
	root: string; //project root path, default value is `Process.cwd()`
	app: AppConfig; // user script meta message  app <=> Tampermonkey header
	monkey: ResolvedMonkeyConfig; // vite-plugin-monkey build config
	source: ResolvedSourceConfig; // tell cli where find the injection components
	injector: ResolvedInjectorConfig; // global `Injector` runtime config
};
export type MonkeyUserscriptOption = NonNullable<MonkeyOption['userscript']>;
