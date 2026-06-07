# 核心概念

Makoo 的概念不多，但它们不是孤立的名词，而是一条完整链路：项目配置决定 Makoo 如何扫描和构建，
manifest 描述要注入什么，生成的运行时入口注册这些注入任务，最后由 injector 在目标页面准备好后完成挂载。

```txt
vite.config.ts
   -> 扫描 injections/
   -> 读取 manifest
   -> 生成运行时入口
   -> 注册任务
   -> 等待目标 DOM
   -> 通过 Vue 或 React adapter 挂载组件
```

理解这条流程后，后面的配置、manifest、HMR 和 recipes 会更容易读。

## 项目配置

Makoo 的项目级配置写在 `vite.config.ts` 的 `makoo()` 插件里：

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1'
	},
	source: {
		include: ['*']
	},
	injector: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	monkey: {
		userscript: {
			match: ['https://example.com/*']
		}
	}
});
```

这个文件适合放项目级行为：

- `app` 描述 Makoo 应用元信息。
- `source` 控制 Makoo 扫描哪些注入模块。
- `injector` 设置模块共享的运行时默认值。
- `monkey` 会透传给 `vite-plugin-monkey`，用于 userscript 元信息、开发服务和构建行为。

它回答的是“这个项目应该如何运行和构建”。它不应该变成每个模块具体注入行为的集中配置文件。

## Manifest

Manifest 用来声明“要注入什么”。顶层 `injections/manifest.ts` 描述项目里的模块：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		header: {
			injectAt: '#header',
			component: './header/app.vue'
		},
		badge: {
			injectAt: 'body',
			component: './badge/app.tsx',
			match: {
				include: ['https://example.com/profile/*']
			}
		}
	}
});
```

Manifest 适合放模块级行为：

- 有哪些模块
- 每个模块挂载哪个组件
- 每个模块等待哪个 DOM 选择器
- 模块是否启用
- 模块级 URL 匹配规则
- 模块级运行时选项，例如 `alive`、`scope`、`timeout`、`hooks` 和事件绑定

简单说：`vite.config.ts` 配置项目，`injections/manifest.ts` 配置注入模块。

## Injection Module

注入模块是 userscript 中的一个独立功能或挂载点。它通常对应 `injections/` 下的一个目录：

```txt
injections
├─ manifest.ts
├─ profile-card
│  └─ app.vue
└─ react-badge
   ├─ app.tsx
   └─ style.css
```

一个模块应该维护这个注入点需要的代码：组件、样式、本地 helper，以及可选的模块级 manifest
信息。这样大型 userscript 就不会变成一个同时知道所有页面、所有目标节点、所有功能的大文件。

模块名可以来自对象写法里的 manifest key：

```ts
defineInjections({
	injections: {
		'profile-card': {
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	}
});
```

也可以来自数组写法里的 `name` 字段：

```ts
defineInjections({
	injections: [
		{
			name: 'profile-card',
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	]
});
```

## Injector

`Injector` 是 Makoo 的运行时调度器。它负责把解析后的模块变成正在运行的任务。

运行时，injector 会做这些事：

- 注册组件任务和监听器任务
- 等待每个 `injectAt` 选择器出现
- 管理任务的 `idle`、`pending`、`active` 状态
- 调用匹配的 adapter 挂载组件
- 向挂载后的组件暴露 Makoo context
- 在需要时重置或销毁任务
- 在启用 `alive` 时处理重新注入

一般 Makoo 项目里，用户不需要手动创建 `Injector`。Vite 插件会生成运行时入口并创建、运行它。
你主要通过 manifest 选项和 adapter 传入组件的 `makoo` context 间接和 injector 交互。

## Task

Task 是由模块或监听器注册后生成的运行时记录。组件任务里会保存目标选择器、组件 artifact、
adapter、timeout、alive 设置和挂载状态。

任务状态刻意保持简单：

| 状态 | 含义 |
| --- | --- |
| `idle` | 已注册，但当前没有等待或挂载 |
| `pending` | 正在等待目标 DOM 节点 |
| `active` | 已找到目标，并完成模块挂载或监听器绑定 |

通常你不会直接创建 task，而是通过 manifest 字段间接配置它们。运行时会用 task 协调 DOM
ready、挂载、监听器和清理行为。

## Adapter

Adapter 是 Makoo 运行时和组件框架之间的桥接层。Makoo 不会把 Vue 或 React 的挂载逻辑硬编码在
injector 里，而是交给 adapter 来说明：

- 它是否能处理某个组件 artifact
- 如何把这个 artifact 挂载到 Makoo 创建的 mount point
- 在 reset、destroy 或 remount 时如何卸载

Makoo 目前通过 `@makoojs/vue` 和 `@makoojs/react` 提供 Vue / React adapter。

通过 adapter 挂载的组件会收到一个 Makoo context。这个 context 包含 task id、目标选择器、
`reset()`、`destroy()` 等生命周期控制、hook 注册能力、logger 和监听器控制能力。

## Alive 重新注入

宿主页面经常会在 userscript 挂载后重绘或替换 DOM。`alive` 就是 Makoo 为这种情况提供的重新注入机制。

模块启用 `alive` 后，Makoo 会观察目标区域，并在原来的挂载不再存活时尝试重新挂载模块。观察范围由
`scope` 控制：

| Scope | 含义 |
| --- | --- |
| `local` | 观察目标附近区域 |
| `global` | 观察更大的 document 范围 |

对于频繁替换内容的页面，可以启用 `alive`。对于稳定目标，建议保持关闭，避免不必要的观察开销。

## Hooks

Hooks 用来观察 Makoo 的生命周期事件。它适合做日志、调试、统计，或者围绕注册、运行、挂载、监听器和
DOM 事件协调一些行为。

Hooks 可以通过项目级 injector 配置全局设置，也可以通过 manifest 给单个模块设置：

```ts
defineInjections({
	globalInjector: {
		hooks: {
			'run:start': (payload) => {
				console.log('[makoo] run started', payload);
			}
		}
	},
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			hooks: {
				'artifact:mountSuccess': (payload) => {
					console.log('[makoo] panel mounted', payload);
				}
			}
		}
	}
});
```

全局 hooks 适合项目级观察。模块 hooks 更适合只属于某个注入模块的逻辑。

## 这些概念如何配合

最重要的边界是：

| 层级 | 文件 | 职责 |
| --- | --- | --- |
| 项目配置 | `vite.config.ts` | 构建、扫描、全局默认值、userscript 元信息 |
| 注入配置 | `injections/manifest.ts` | 模块、目标节点、组件、模块行为 |
| 运行时 | 生成入口和 `Injector` | 注册、等待、挂载、重新注入、清理 |
| 框架桥接 | Vue 或 React adapter | 挂载和卸载框架组件 |

这层分离正是 Makoo 更像框架层、而不只是工具函数库的原因。它定义了一个 userscript 项目如何配置、
组织、生成和运行。
