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
function makooDev(): Plugin;
```

Shows, in the dev terminal, the connections of Core instances on the page and the status and errors of each injection; takes no arguments. Put it in `plugins` together with `makoo()` and start with `makoo dev`; it only takes effect in the dev server and doesn't affect build output.

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

Fields such as `app` and `entry` are validated at startup; on failure, `MAKOO_CLI_CONFIG_INVALID` is thrown, with one `field path: reason` per line in the message. `entry`, `app.name`, and `app.version` must be non-empty strings, and unknown fields at the top level (other than `root`, `entry`, `app`, and `monkey`) and in `app` are rejected; other fields in `monkey` are passed to vite-plugin-monkey as-is.

### Settings Determined by vite-plugin-monkey

`makoo()` uses vite-plugin-monkey internally, which fixes the following settings; same-named values in the Vite config and CLI options have no effect:

- Build: `build.sourcemap` is `false`, `build.assetsDir` is `'./'`, all assets are inlined, and CSS is not split.
- Minification: JS is not minified when `build.minify` is not set; CSS is minified by default (`build.cssMinify`).
- Dev and preview servers: `cors` is fixed to `true`.
- Dev script: `@grant *` is declared automatically, so all GM APIs are available; the build output's `@grant` is inferred from the code by `autoGrant`, so the two may differ.
