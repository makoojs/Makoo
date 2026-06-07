# @makoojs/cli

`@makoojs/cli` 提供 Makoo 的 Vite 插件、manifest 类型辅助函数，以及部分 `vite-plugin-monkey` 的透传导出。它负责解析配置、扫描 `injections/`、生成运行时入口，并把最终 userscript 构建交给 `vite-plugin-monkey`。

## 导出概览

```ts
import { makoo, defineInjections, defineInjection, cdn } from '@makoojs/cli';
```

常用类型：

```ts
import type {
	MakooOptions,
	AppConfig,
	CliConfig,
	SourceConfig,
	RuntimeConfig,
	InjectorConfig,
	MonkeyConfig,
	MonkeyBuildConfig,
	MonkeyServerConfig,
	InjectionManifest,
	InjectionModuleConfig,
	InjectionFramework
} from '@makoojs/cli';
```

## makoo()

`makoo()` 是 Vite 插件入口。它会返回一个插件数组：Makoo 自己的扫描/虚拟入口插件，以及 `vite-plugin-monkey` 插件。

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			app: {
				name: 'selector-picker',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					namespace: 'npm/makoo',
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

签名：

```ts
function makoo(options: MakooOptions): Plugin[];
```

`MakooOptions` 基于 `CliConfig`，并额外支持 `root`：

```ts
type MakooOptions = CliConfig & {
	root?: string;
};
```

## 配置结构

```ts
type CliConfig = {
	app: AppConfig;
	monkey?: MonkeyConfig;
	source?: SourceConfig;
	injector?: InjectorConfig;
	runtime?: RuntimeConfig;
};
```

### app

`app` 是 Makoo 应用级元信息。

```ts
type AppConfig = {
	name: string;
	version: string;
	description?: string;
};
```

`name` 和 `version` 会参与生成 userscript 元信息。`description` 可用于描述脚本。

### monkey

`monkey` 大部分配置会透传给 `vite-plugin-monkey`。

```ts
type MonkeyConfig = {
	userscript?: MonkeyUserScript;
	align?: number | false;
	generate?: (options: MonkeyGenerateContext) => Thenable<string>;
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};
```

常用配置：

```ts
makoo({
	app: {
		name: 'my-tool',
		version: '0.0.1'
	},
	monkey: {
		userscript: {
			namespace: 'npm/makoo',
			match: ['https://example.com/*'],
			grant: ['GM_setValue', 'GM_getValue']
		},
		server: {
			open: false,
			prefix: 'server:'
		},
		build: {
			fileName: 'my-tool.user.js',
			metaFileName: false
		}
	}
});
```

Makoo 会内部管理 `clientAlias` 和 `server.mountGmApi`，这两个选项不应该由用户配置。

### source

`source` 控制 Makoo 扫描哪些注入模块。

```ts
type SourceConfig = {
	include?: string[];
	exclude?: string[];
};
```

默认扫描 `injections/` 下的一级目录：

```ts
source: {
	include: ['*'],
	exclude: []
}
```

这里的 `include` / `exclude` 是模块目录过滤规则，不是 URL 匹配规则。

### injector

`injector` 设置项目级运行时默认值。

```ts
type InjectorConfig = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	hooks?: LifecycleHookMap;
};
```

示例：

```ts
makoo({
	app: {
		name: 'my-tool',
		version: '0.0.1'
	},
	injector: {
		alive: false,
		scope: 'local',
		timeout: 5000
	}
});
```

模块级 manifest 可以覆盖这些默认值。

### runtime

`runtime.setup` 会在 Makoo 创建并运行 injector 前导入副作用文件。

```ts
type RuntimeConfig = {
	setup?: string | string[];
};
```

示例：

```ts
makoo({
	app: {
		name: 'my-tool',
		version: '0.0.1'
	},
	runtime: {
		setup: ['./injections/setup.js']
	}
});
```

它适合做项目级运行时准备，例如创建独立挂载节点、安装全局服务、导入副作用 polyfill 等。

## defineInjections()

`defineInjections()` 是 manifest 的类型辅助函数。它不改变运行时值，只帮助 TypeScript 检查配置形状。

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	globalInjector: {
		alive: true,
		scope: 'global'
	},
	injections: {
		'selector-picker': {
			injectAt: 'body',
			component: './devtools/app.jsx',
			framework: 'React'
		}
	}
});
```

签名：

```ts
function defineInjections<T extends InjectionManifest>(manifest: T): T;
```

## defineInjection()

`defineInjection()` 是单个模块配置的类型辅助函数，适合模块级 manifest。

```ts
import { defineInjection } from '@makoojs/cli';

export default defineInjection({
	injectAt: '#toolbar',
	component: './app.vue',
	framework: 'Vue',
	alive: true
});
```

签名：

```ts
function defineInjection<T extends InjectionModuleConfig>(config: T): T;
```

## Manifest 类型

顶层 manifest：

```ts
type InjectionManifest = {
	globalInjector?: InjectorConfig;
	injections: InjectionModuleConfig[] | Record<string, Omit<InjectionModuleConfig, 'name'>>;
};
```

模块配置：

```ts
type InjectionModuleConfig = ArtifactOptions & {
	name?: string;
	injectAt: string;
	component: string;
	framework?: 'auto' | 'Vue' | 'React';
	enabled?: boolean;
	match?: string[] | {
		include?: string[];
		exclude?: string[];
	};
};
```

常用字段：

| 字段 | 说明 |
| --- | --- |
| `name` | 数组写法下的稳定模块 id |
| `injectAt` | 目标 DOM CSS 选择器 |
| `component` | 组件路径，相对于当前 manifest |
| `framework` | `'auto'`、`'Vue'` 或 `'React'` |
| `enabled` | 是否启用模块，默认 `true` |
| `match` | 模块级 URL 匹配 |
| `alive` | 是否启用重新注入 |
| `scope` | alive 观察范围，`'local'` 或 `'global'` |
| `timeout` | 等待目标节点的毫秒数 |
| `hooks` | 模块级生命周期 hooks |
| `on` | 随组件任务一起绑定的外部事件监听 |

## cdn

`cdn` 从 `vite-plugin-monkey` 透传导出，用于配置外部依赖的 CDN 地址。

```ts
import { cdn } from '@makoojs/cli';
```

具体用法和支持的参数遵循 `vite-plugin-monkey`。

## CLI 命令

安装脚手架项目后，常见脚本通常是：

```json
{
	"scripts": {
		"dev": "makoo dev",
		"build": "makoo build"
	}
}
```

命令说明：

| 命令 | 说明 |
| --- | --- |
| `makoo dev` | 启动 Vite 开发服务并生成开发 userscript |
| `makoo build` | 构建生产 userscript |
| `makoo inspect` | 检查解析后的配置和扫描结果 |
| `makoo add` | 向 manifest 添加注入模块配置 |
