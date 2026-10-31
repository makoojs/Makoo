# Vite Plugins

Import the plugins from `@makoojs/cli` in `vite.config.ts`. This code runs in Node. For setup steps, see [Project Configuration](../docs/configuration.md); for terminal usage, see [Local Development](../docs/development.md).

## `makoo()`

Creates Vite plugins from the Makoo configuration.

### Type {#type}

```ts
function makoo(options: MakooOptions): Plugin[];
```

### Parameters {#parameters}

`options` uses `MakooOptions`.

### Returns {#returns}

Returns a `Plugin[]`.

### Example {#example}

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/main.ts',
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

## `makooDev()`

```ts
function makooDev(options?: MakooDevOptions): Plugin;

type MakooDevOptions = {
	port?: number;
	host?: string;
};
```

Shows, in the dev terminal, the connections of Core instances on the page and the status and errors of each injection. Put it in `plugins` together with `makoo()`; the terminal is taken over whether you start with `makoo dev` or `vite`. It only takes effect in the dev server and doesn't affect build output.

The page reports status to the terminal through a separate bridge server, not through the Vite port:

| Option | Default | Description |
| --- | --- | --- |
| `port` | `9999` | Fixed bridge port, an integer from 1 to 65535; no fallback to another port |
| `host` | `'127.0.0.1'` | Bridge listen address; an IPv4/IPv6 literal or `'localhost'` |

An invalid `port` or `host` throws when `makooDev()` is called. The bridge address stays the same across restarts of the dev server.

- When the bridge port is in use, the terminal prints a warning and the bridge isn't started; the Vite server keeps running, and the terminal shows no injections. Pass another port with `makooDev({ port })`.
- When `host` isn't a loopback address, the bridge is reachable from other machines and is protected only by a token; the terminal prints a warning at startup.
- Middleware mode (`server.middlewareMode`) isn't supported; the plugin prints a warning and starts neither the bridge nor the terminal.
- When `makooDev()` is registered more than once, only the first one takes effect, and a warning is printed.

`makooDev()` only reads status handles and instance observation and reports them; it doesn't start, stop, or remove injections, and doesn't handle hot updates.

`makoo()` handles the userscript build and installation entry; `makooDev()` handles injection inspection during development. Add them separately.

## `cdn`

CDN configuration factories re-exported from `vite-plugin-monkey`.

### Type {#type-1}

```ts
type CdnFactory = (
	exportVarName?: string,
	pathname?: string
) => [string, ModuleToUrlFc];

const cdn: {
	jsdelivr: CdnFactory;
	jsdelivrFastly: CdnFactory;
	unpkg: CdnFactory;
	cdnjs: CdnFactory;
	zhimg: CdnFactory;
	elemecdn: CdnFactory;
	bdstatic: CdnFactory;
	npmmirror: CdnFactory;
	bootcdn: CdnFactory;
	staticfile: CdnFactory;
};
```

`bootcdn` and `staticfile` are marked as deprecated by `vite-plugin-monkey`.

## Configuration Types

### `MakooOptions`

```ts
type MakooOptions = CliConfig & {
	root?: string;
};
```

### `CliConfig`

```ts
type CliConfig = {
	entry: string;
	app: AppConfig;
	monkey: MonkeyConfig;
};
```

### `AppConfig`

```ts
type AppConfig = {
	name: string;
	version: string;
	description?: string;
};
```

### `MonkeyConfig`

```ts
type MonkeyConfig = {
	userscript?: Omit<MonkeyUserScript, 'name' | 'version' | 'description'>;
	align?: number | false;
	generate?: (options: {
		userscript: string;
		mode: 'serve' | 'build' | 'meta';
	}) => string | Promise<string>;
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};
```

### `MonkeyServerConfig`

```ts
type MonkeyServerConfig = {
	open?: boolean;
	prefix?: string | ((name: string) => string) | false;
};
```

### `MonkeyBuildConfig`

```ts
type MonkeyBuildConfig = {
	fileName?: string;
	metaFileName?: string | boolean | ((fileName: string) => string);
	externalGlobals?: ExternalGlobals;
	autoGrant?: boolean;
	externalResource?: ExternalResource;
	systemjs?: 'inline' | ((
		version: string,
		packageName: string,
		importName?: string,
		resolveName?: string
	) => string);
	cssSideEffects?: string | ((css: string) => void);
};
```

## Defaults and Field Constraints

| Field | Default or constraint |
| --- | --- |
| `root` | Current working directory |
| `entry` | Required; resolved relative to root |
| `app.name / app.version` | Required; control the userscript fields of the same name |
| `app.description` | Optional; controls the userscript description |
| `monkey` | Required; may be an empty object |
| `monkey.align` | 2 |
| `monkey.styleImport` | true |
| `monkey.server.open` | true on Windows/macOS, false on other platforms |
| `monkey.server.prefix` | `` (name) => `server:${name}` ``; see the note below |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | false; when true, replaces the trailing `.user.js` of the file name with `.meta.js` |
| `monkey.build.autoGrant` | true |

`monkey.server.prefix` determines the dev script's name in the script manager, and the three forms behave differently:

| Form | Dev script name |
| --- | --- |
| Function, including the default | The function's return value; `server:my-script` by default |
| String, for example `'dev'` | The whole name is replaced by this string |
| `false` | Same as `app.name` |

The type of `monkey.userscript` doesn't include `name`, `version`, or `description`; if they are passed at runtime anyway, they are overridden by the same-named fields of `app` without an error.

These fields are constrained only by the TypeScript types and aren't validated at runtime; with type checking enabled, `vite.config.ts` catches missing or misspelled fields. Fields in `monkey` not listed above are passed to vite-plugin-monkey as-is.

### Settings Determined by vite-plugin-monkey

`makoo()` uses vite-plugin-monkey internally, which fixes the following settings; same-named values in the Vite config and CLI options have no effect:

- Build: `build.sourcemap` is `false`, `build.assetsDir` is `'./'`, all assets are inlined, and CSS is not split.
- Minification: JS is not minified when `build.minify` is not set; CSS is minified by default (`build.cssMinify`).
- Dev and preview servers: `cors` is fixed to `true`.
- Dev script: `@grant *` is declared automatically, so all GM APIs are available; the build output's `@grant` is inferred from the code by `autoGrant`, so the two may differ.
