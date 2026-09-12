# Vite Plugins

Import plugins from `@makoojs/cli` in `vite.config.ts`. See [Configuration](../docs/configuration.md) for setup and [Local Development](../docs/development.md) for terminal usage.

## `makoo()`

Creates Vite plugins from Makoo configuration.

### Type

```ts
function makoo(options: MakooOptions): Plugin[];
```

### Parameters

`options` uses `MakooOptions`.

### Returns

Returns `Plugin[]`.

### Example

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

Enables development Runtime connections and task inspection. It takes no arguments. Add it alongside `makoo()` and start with `makoo dev`. It applies to the dev server.

`makoo()` provides userscript building and the installation entry. `makooDev()` provides development task inspection. Add each plugin explicitly.

## `cdn`

CDN configuration factories re-exported from `vite-plugin-monkey`.

### Type

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

## Configuration types

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

## Defaults and constraints

| Field | Default or constraint |
| --- | --- |
| `root` | Working directory |
| `entry` | Required; resolved relative to root |
| `app.name / app.version` | Required; own the corresponding userscript fields |
| `app.description` | Optional; owns userscript description |
| `monkey` | Required; may be an empty object |
| `monkey.align` | 2 |
| `monkey.styleImport` | true |
| `monkey.server.open` | true on Windows/macOS; false elsewhere |
| `monkey.server.prefix` | 'server:' |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | false; true derives a .meta.js filename from the script filename |
| `monkey.build.autoGrant` | true |

`monkey.userscript` does not accept `name`, `version`, or `description`; set these through `app`.
