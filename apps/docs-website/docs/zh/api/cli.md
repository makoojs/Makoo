# CLI API

## API 索引

### `@makoojs/cli`

- [`makoo()`](#makoo)：创建 Makoo 与 userscript Vite plugins
- [`cdn`](#cdn)：生成外部依赖的 CDN 配置
- [配置类型](#配置类型)：`MakooOptions`、`CliConfig` 和 monkey 配置

### `@makoojs/cli/manifest`

- [`defineInjections()`](#defineinjections)：声明顶层 manifest
- [`defineInjection()`](#defineinjection)：声明模块 manifest
- [Manifest 类型](#manifest-类型)

### `@makoojs/cli/monkey`

- [GM API](#gm-api)：userscript API 封装
- [GM 类型](#gm-类型)

### 命令行

- [CLI 命令](#cli-命令)

## `makoo()`

根据 Makoo 配置创建 Vite plugins。

### Type

```ts
function makoo(options: MakooOptions): Plugin[];
```

### Parameters

`options` 使用 `MakooOptions`，其中 `app` 为必填字段。

### Returns

返回一个 `Plugin[]`。在 Vite 配置中需要使用展开语法。

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

从 `vite-plugin-monkey` 重新导出的 CDN 配置生成器。

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

`bootcdn` 和 `staticfile` 由 `vite-plugin-monkey` 标记为 deprecated。

## 配置类型

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

`include` 和 `exclude` 匹配 injection 模块目录名。

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

声明顶层 `InjectionManifest`，并保留传入对象的具体类型。

### Type

```ts
function defineInjections<T extends InjectionManifest>(
	manifest: StrictShape<InjectionManifest, T>
): T;
```

### Returns

原样返回 `manifest`。

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
			callback: onEscape
		}
	}
});
```

## `defineInjection()`

声明单个 `InjectionModuleConfig`，并保留传入对象的具体类型。

### Type

```ts
function defineInjection<T extends InjectionModuleConfig>(
	config: StrictShape<InjectionModuleConfig, T>
): T;
```

### Returns

原样返回 `config`。

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
		callback: onClick
	}
});
```

## Manifest 类型

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

## GM API

以下值从 `@makoojs/cli/monkey` 导出。

| 导出 | 方法或值 |
| --- | --- |
| `GMapi` | 包含 `raw`、`info`、`log`、`storage`、`style`、`request`、`menu`、`clipboard`、`notification`、`tab`、`download` 和 `resource` |
| `gm` | 原始 `GM` 对象 |
| `gmInfo` | `GM_info` |
| `gmLog` | `GM_log` |
| `monkeyWindow` | userscript window |
| `unsafeWindow` | 页面 window |
| `gmClipboard` | `set(data, type?, callback?)` |
| `gmDownload` | `start` |
| `gmMenu` | `register`、`unregister` |
| `gmNotification` | `show` |
| `gmRequest` | `send`、`get`、`post` |
| `gmResource` | `text`、`url` |
| `gmStorage` | `get`、`getMany`、`set`、`setMany`、`remove`、`removeMany`、`keys`、`watch`、`unwatch` |
| `gmStyle` | `add`、`element` |
| `gmTab` | `open`、`get`、`getAll`、`save` |

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

`get()` 和 `post()` 分别固定请求方法为 `GET` 和 `POST`。

## GM 类型

```ts
type GmRequestOptions<R extends GmResponseType = 'text', C = unknown> = Omit<
	GmXmlhttpRequestOption<R, C>,
	'url' | 'method'
>;
```

`@makoojs/cli/monkey` 还重新导出以下 `vite-plugin-monkey` 类型：

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

## CLI 命令

| 命令 | 说明 |
| --- | --- |
| `makoo dev` | 启动 Vite 开发服务器 |
| `makoo build` | 执行 Vite 构建 |
| `makoo add <name>` | 创建 React injection 模块并更新 manifest |
| `makoo add <name> --framework Vue` | 创建 Vue injection 模块并更新 manifest |
| `makoo inspect` | 输出解析后的配置、扫描结果和 framework 信息 |
