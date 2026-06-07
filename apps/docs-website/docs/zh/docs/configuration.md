# 配置

Makoo 通过 Vite 插件 `makoo()` 配置。这个文件描述项目级行为：Makoo 如何扫描模块、运行时默认值是什么，以及最终 userscript 如何交给 `vite-plugin-monkey`。

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			app: {
				name: 'my-script',
				version: '0.0.1',
				description: 'Enhance example.com with injected UI'
			},
			source: {
				include: ['*'],
				exclude: []
			},
			injector: {
				alive: false,
				scope: 'local',
				timeout: 5000
			},
			runtime: {
				setup: ['./injections/setup.ts']
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

`vite.config.ts` 适合放影响整个项目的配置。具体到某个模块的 `injectAt`、`component`、`match`、`alive` 和 hooks，应放在 `injections/manifest.ts`。

## 配置分组

| 分组 | 作用 |
| --- | --- |
| `app` | Makoo 应用元信息，以及默认 userscript 名称和版本 |
| `source` | 控制 `injections/` 下哪些模块目录会被扫描 |
| `injector` | 模块继承的运行时默认值 |
| `runtime` | injector 设置前先导入的副作用 setup 文件 |
| `monkey` | `vite-plugin-monkey` 的 userscript、开发服务和构建配置 |

## `app`

`app` 是必填项。

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1',
		description: 'Optional script description'
	}
});
```

| 字段 | 说明 |
| --- | --- |
| `name` | 必填应用名称，也会作为默认 userscript `name` |
| `version` | 必填版本，也会作为默认 userscript `version` |
| `description` | 可选描述，也会作为默认 userscript `description` |

如果需要更细的控制，可以在 `monkey.userscript` 中覆盖最终 userscript 元信息。

## `source`

`source` 控制模块扫描。

```ts
makoo({
	source: {
		include: ['*'],
		exclude: ['draft-*']
	}
});
```

Makoo 当前扫描固定的 `injections/` 目录。顶层 manifest 文件名也固定为 `manifest`，所以 Makoo 会查找 `injections/manifest.ts`，以及 `injections/panel/manifest.ts` 这样的模块级 manifest。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `include` | `['*']` | 要包含的 `injections/` 下目录名模式 |
| `exclude` | `[]` | 要排除的 `injections/` 下目录名模式 |

这些模式过滤的是模块目录，不是页面 URL。页面 URL 匹配应使用整体 userscript 的 `monkey.userscript.match`，或 manifest 中的模块级 `match`。

## `injector`

`injector` 定义模块的运行时默认值。

```ts
makoo({
	injector: {
		alive: false,
		scope: 'local',
		timeout: 5000,
		hooks: {
			'run:start': (payload) => {
				console.log('[makoo] run started', payload);
			}
		}
	}
});
```

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `alive` | `false` | 模块挂载消失后是否尝试重新注入 |
| `scope` | `'local'` | 重新注入观察范围，可选 `'local'` 或 `'global'` |
| `timeout` | `5000` | 等待每个目标选择器的毫秒数 |
| `hooks` | `{}` | 全局生命周期 hooks |

模块会继承这些默认值，除非在 manifest 中设置自己的 `alive`、`scope`、`timeout` 或 `hooks`。顶层 manifest 也可以提供 `globalInjector`，它会作为当前扫描结果的运行时 injector 配置。

## `runtime`

`runtime.setup` 会在 Makoo 创建并运行 injector 前导入副作用文件。

```ts
makoo({
	runtime: {
		setup: ['./injections/setup.ts', './injections/polyfills.ts']
	}
});
```

Setup 文件适合放项目级运行时准备工作，例如安装全局变量、初始化共享服务，或导入副作用样式。开发时，Makoo 会追踪 setup 文件及其本地依赖，修改它们会触发结构更新。

## `monkey`

大多数 `monkey` 配置会透传给 `vite-plugin-monkey`。

```ts
makoo({
	monkey: {
		userscript: {
			namespace: 'npm/makoo',
			match: ['https://example.com/*'],
			grant: ['GM_getValue', 'GM_setValue']
		},
		server: {
			open: true,
			prefix: 'server:'
		},
		build: {
			fileName: 'my-script.user.js',
			metaFileName: true,
			autoGrant: true
		}
	}
});
```

Makoo 会内部管理一部分 `vite-plugin-monkey` 细节：

| 选项 | Makoo 行为 |
| --- | --- |
| `entry` | 由 Makoo 生成 |
| `clientAlias` | 内部固定 |
| `server.mountGmApi` | 内部固定 |

不要设置 `monkey.clientAlias` 或 `monkey.server.mountGmApi`；Makoo 会校验并拒绝这些选项，因为它们会和运行时集成冲突。

## 默认值

主要默认值如下：

| 选项 | 默认值 |
| --- | --- |
| `source.include` | `['*']` |
| `source.exclude` | `[]` |
| `injector.alive` | `false` |
| `injector.scope` | `'local'` |
| `injector.timeout` | `5000` |
| `runtime.setup` | `[]` |
| `monkey.align` | `2` |
| `monkey.styleImport` | `true` |
| `monkey.server.prefix` | `'server:'` |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | `false` |
| `monkey.build.autoGrant` | `true` |

## 配置边界

记住这个分工：

| 文件 | 负责 |
| --- | --- |
| `vite.config.ts` | 项目元信息、扫描、全局运行时默认值、userscript 开发/构建选项 |
| `injections/manifest.ts` | 注入模块、目标选择器、组件路径、模块 URL 规则 |
| `injections/<module>/` | 组件代码、模块样式、模块 helper、可选模块级 manifest |

这个边界能让 Makoo 项目变大后仍然清楚。
