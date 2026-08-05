# CLI API Reference

## API Index

### `@makoojs/cli`

- [`makoo()`](#makoo): creates the Makoo and userscript Vite plugins
- [`cdn`](#cdn): creates CDN configuration for external dependencies
- [Configuration types](#configuration-types): `MakooOptions`, `CliConfig`, and monkey configuration

### `@makoojs/cli/manifest`

- [`defineInjections()`](#defineinjections): declares a top-level manifest
- [`defineInjection()`](#defineinjection): declares a module manifest
- [Manifest types](#manifest-types)

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

`options` uses `MakooOptions`. Its `app` field is required.

### Returns

Returns `Plugin[]`. Use spread syntax in the Vite configuration.

### Example

```ts
export default defineConfig({
	plugins: [
		...makoo({
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
	app: AppConfig;
	monkey?: MonkeyConfig;
	source?: SourceConfig;
	runtime?: {
		setup?: string | string[];
	};
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

### `SourceConfig`

```ts
type SourceConfig = {
	include?: string[];
	exclude?: string[];
};
```

`include` and `exclude` match injection module directory names.

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

## `defineInjections()`

Declares a top-level `InjectionManifest` while preserving the specific type of the provided object.

### Type

```ts
function defineInjections<T extends InjectionManifest>(
	manifest: StrictShape<InjectionManifest, T>
): T;
```

### Returns

Returns `manifest` unchanged.

### Example

```ts
export default defineInjections({
	injectionDefaults: {
		alive: true
	},
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/App.vue'
		}
	},
	listeners: {
		escape: {
			listenAt: 'body',
			type: 'keydown',
			capture: true,
			callback: onEscape
		}
	}
});
```

## `defineInjection()`

Declares one `InjectionModuleConfig` while preserving the specific type of the provided object.

### Type

```ts
function defineInjection<T extends InjectionModuleConfig>(
	config: StrictShape<InjectionModuleConfig, T>
): T;
```

### Returns

Returns `config` unchanged.

### Example

```ts
export default defineInjection({
	name: 'panel',
	injectAt: 'body',
	component: './App.vue',
	hooks: {
		'artifact:mountSuccess': onMounted
	},
	on: {
		listenAt: 'body',
		type: 'click',
		capture: true,
		callback: onClick
	}
});
```

## Manifest types

### `InjectionManifest`

```ts
type InjectionManifest = {
	injectionDefaults?: InjectionDefaults;
	injections?: InjectionModuleConfig[] | Record<
		string,
		Omit<InjectionModuleConfig, 'name'>
	>;
	listeners?: InjectionListenerConfig[] | Record<
		string,
		Omit<InjectionListenerConfig, 'name'>
	>;
};
```

### `InjectionDefaults`

```ts
type InjectionDefaults = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	hooks?: LifecycleHookMap;
};
```

### `InjectionModuleConfig`

```ts
type InjectionModuleConfig = {
	name?: string;
	injectAt: string;
	component: string;
	framework?: InjectionFramework;
	enabled?: boolean;
	match?: InjectionMatchConfig;
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	hooks?: LifecycleHookMap;
	on?: InjectionModuleListenerConfig;
};
```

### `InjectionListenerConfig`

```ts
type InjectionModuleListenerConfig = {
	listenAt: string;
	type: string;
	callback: EventListener;
	capture?: boolean;
	activitySignal?: () => ActivitySignalSource<boolean>;
};

type InjectionListenerConfig = InjectionModuleListenerConfig & {
	name?: string;
	enabled?: boolean;
	match?: InjectionMatchConfig;
};
```

Set `capture: true` to listen during the DOM capture phase. It defaults to `false`, so listeners
use the bubbling phase unless explicitly configured. Makoo manages the event listener signal.

### `InjectionFramework`

```ts
type InjectionFramework = 'auto' | 'Vue' | 'React';
```

### `InjectionMatchConfig`

```ts
type InjectionMatchConfig =
	| string[]
	| {
		include?: string[];
		exclude?: string[];
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
| `makoo add <name>` | Creates a React injection module and updates the manifest |
| `makoo add <name> --framework Vue` | Creates a Vue injection module and updates the manifest |
| `makoo inspect` | Prints resolved configuration, scan results, and framework information |
