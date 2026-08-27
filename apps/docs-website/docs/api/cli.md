# CLI API Reference

## API Index

### `@makoojs/cli`

- [`makoo()`](#makoo): creates the Makoo and userscript Vite plugins
- [`cdn`](#cdn): creates CDN configuration for external dependencies
- [Configuration types](#configuration-types): `MakooOptions`, `CliConfig`, and monkey configuration

### `@makoojs/cli/monkey`

- [GM APIs](#gm-apis): userscript API wrappers
- [GM types](#gm-types)

### Command line

- [CLI commands](#cli-commands)

## `makoo()`

Creates Vite plugins from Makoo configuration.

### Type

```ts
function makoo(options: MakooOptions): Plugin[];
```

### Parameters

`options` uses `MakooOptions`. Its `entry` and `app` fields are required.

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
	monkey?: MonkeyConfig;
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
	userscript?: MonkeyUserScript;
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

## GM APIs

The following values are exported from `@makoojs/cli/monkey`.

| Export | Methods or value |
| --- | --- |
| `GMapi` | Contains `raw`, `info`, `log`, `storage`, `style`, `request`, `menu`, `clipboard`, `notification`, `tab`, `download`, and `resource` |
| `gm` | Original `GM` object |
| `gmInfo` | `GM_info` |
| `gmLog` | `GM_log` |
| `monkeyWindow` | Userscript window |
| `unsafeWindow` | Page window |
| `gmClipboard` | `set(data, type?, callback?)` |
| `gmDownload` | `start` |
| `gmMenu` | `register`, `unregister` |
| `gmNotification` | `show` |
| `gmRequest` | `send`, `get`, `post` |
| `gmResource` | `text`, `url` |
| `gmStorage` | `get`, `getMany`, `set`, `setMany`, `remove`, `removeMany`, `keys`, `watch`, `unwatch` |
| `gmStyle` | `add`, `element` |
| `gmTab` | `open`, `get`, `getAll`, `save` |

### `gmRequest.get()` / `gmRequest.post()`

```ts
gmRequest.get<R extends GmResponseType = 'text', C = unknown>(
	url: string,
	options?: GmRequestOptions<R, C>
): GmAbortHandle;

gmRequest.post<R extends GmResponseType = 'text', C = unknown>(
	url: string,
	options?: GmRequestOptions<R, C>
): GmAbortHandle;
```

`get()` and `post()` set the request method to `GET` and `POST`, respectively.

## GM types

```ts
type GmRequestOptions<R extends GmResponseType = 'text', C = unknown> = Omit<
	GmXmlhttpRequestOption<R, C>,
	'url' | 'method'
>;
```

`@makoojs/cli/monkey` also re-exports these types from `vite-plugin-monkey`:

- `GmAbortHandle`
- `GmAddElementAttributes`
- `GmDownloadOptions`
- `GmInfoType`
- `GmMenuCommandOptions`
- `GmNotificationOptions`
- `GmOpenInTabOptions`
- `GmResponseEvent`
- `GmResponseType`
- `GmTabControl`
- `GmType`
- `GmValueListenerId`
- `GmXmlhttpRequestOption`
- `MonkeyWindow`

## CLI commands

| Command | Description |
| --- | --- |
| `makoo dev` | Starts the Vite development server |
| `makoo build` | Runs a Vite build |
| `makoo preview` | Starts the Vite preview server for the built userscript |
