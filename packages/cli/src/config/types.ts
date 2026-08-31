import type {
	ExternalGlobals,
	ExternalResource,
	MonkeyOption,
	MonkeyUserScript
} from 'vite-plugin-monkey';

export type Thenable<T> = T | Promise<T>;
export type MonkeyMode = 'serve' | 'build' | 'meta';

export type MonkeyGenerateContext = {
	userscript: string;
	mode: MonkeyMode;
};

export type MonkeyServerConfig = {
	open?: boolean;
	prefix?: string | ((name: string) => string) | false;
};

export type MonkeyBuildConfig = {
	fileName?: string;
	metaFileName?: string | boolean | ((fileName: string) => string);
	externalGlobals?: ExternalGlobals;
	autoGrant?: boolean;
	externalResource?: ExternalResource;
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
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};

export type AppConfig = {
	name: string;
	version: string;
	description?: string;
};

export type ResolvedMonkeyServerConfig = {
	open: boolean;
	prefix: string | ((name: string) => string) | false;
	mountGmApi: boolean;
};

export type ResolvedMonkeyBuildConfig = {
	fileName: string;
	metaFileName: string | false;
	externalGlobals?: MonkeyBuildConfig['externalGlobals'];
	autoGrant: boolean;
	externalResource?: MonkeyBuildConfig['externalResource'];
	systemjs?: MonkeyBuildConfig['systemjs'];
	cssSideEffects?: MonkeyBuildConfig['cssSideEffects'];
};

export type ResolvedMonkeyConfig = Omit<
	MonkeyConfig,
	'userscript' | 'align' | 'styleImport' | 'server' | 'build'
> & {
	userscript: MonkeyUserScript;
	align: number | false;
	styleImport: boolean;
	server: ResolvedMonkeyServerConfig;
	build: ResolvedMonkeyBuildConfig;
};

export type CliConfig = {
	entry: string;
	app: AppConfig;
	monkey: MonkeyConfig;
};

export type MakooConfig = CliConfig & {
	root?: string;
};

export type ResolvedMakooConfig = {
	root: string;
	entry: string;
	app: AppConfig;
	monkey: ResolvedMonkeyConfig;
};

export type MonkeyUserscriptOption = NonNullable<MonkeyOption['userscript']>;
