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

/** Dev server options for vite-plugin-monkey. */
export type MonkeyServerConfig = {
	/** Open the install URL in the browser when the dev server starts. Defaults to true on Windows and macOS. */
	open?: boolean;
	/**
	 * Name of the dev script in the script manager: a function maps `app.name` to the name, a
	 * string replaces the whole name, and `false` keeps `app.name`. Defaults to `server:${name}`.
	 */
	prefix?: string | ((name: string) => string) | false;
};

/** Build options for vite-plugin-monkey. */
export type MonkeyBuildConfig = {
	/** Output file name. Defaults to `${app.name}.user.js`. */
	fileName?: string;
	/**
	 * File name of a metadata-only script, usable as `@updateURL`. `true` replaces the trailing
	 * `.user.js` of `fileName` with `.meta.js`; `false` skips the file. Defaults to false.
	 */
	metaFileName?: string | boolean | ((fileName: string) => string);
	/** Modules loaded from a CDN as globals instead of being bundled. */
	externalGlobals?: ExternalGlobals;
	/** Add `@grant` entries for the GM APIs used by the bundle. Defaults to true. */
	autoGrant?: boolean;
	/** Resources, such as CSS files, loaded through `@resource` instead of being bundled. */
	externalResource?: ExternalResource;
	/** Where SystemJS comes from when the code uses dynamic import: inlined, or a URL builder. */
	systemjs?:
		| 'inline'
		| ((
				version: string,
				packageName: string,
				importName?: string,
				resolveName?: string
		  ) => string);
	/** Code that injects the bundled CSS into the page; defaults to `GM_addStyle` when available. */
	cssSideEffects?: string | ((css: string) => void);
};

/** Userscript options. Fields not listed here are passed to vite-plugin-monkey as-is. */
export type MonkeyConfig = {
	/** Userscript metadata; `name`, `version`, and `description` always come from {@link AppConfig}. */
	userscript?: Omit<MonkeyUserScript, 'name' | 'version' | 'description'>;
	/** Column alignment of the metadata block, or `false` for none. Defaults to 2. */
	align?: number | false;
	/** Rewrites the generated metadata block. */
	generate?: (options: MonkeyGenerateContext) => Thenable<string>;
	/** Passed to vite-plugin-monkey's `styleImport`. Defaults to true. */
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};

/** Identity of the userscript. */
export type AppConfig = {
	/** Required; becomes the userscript `@name`. */
	name: string;
	/** Required; becomes the userscript `@version`. */
	version: string;
	/** Becomes the userscript `@description`. */
	description?: string;
};

/** The validated part of the Makoo configuration; unknown top-level fields are rejected. */
export type CliConfig = {
	/** Path of the userscript entry file, resolved relative to `root`. */
	entry: string;
	app: AppConfig;
	/** Required; may be an empty object. */
	monkey: MonkeyConfig;
};

/** Options for `makoo()`. */
export type MakooConfig = CliConfig & {
	/** Project root. Defaults to the current working directory. */
	root?: string;
};

export type MonkeyUserscriptOption = NonNullable<MonkeyOption['userscript']>;

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

export type ResolvedMakooConfig = {
	root: string;
	entry: string;
	app: AppConfig;
	monkey: ResolvedMonkeyConfig;
};
