# 核心概念

Makoo 只有几种概念需要了解，它们组成一条完整链路：项目配置选择应用文件和 userscript
选项，`createMakoo()`、`inject()` 和 `listen()` 提供运行时编排能力；应用调用 `start()` 后，Makoo runtime 注册任务、等待各自的目标 DOM，再完成挂载。

```txt
vite.config.ts
   -> 加载配置的应用模块
   -> 注册任务
   -> 等待目标 DOM
   -> 通过 Vue 或 React adapter 挂载组件
```

## 项目配置

Makoo 的项目级配置写在 `vite.config.ts` 的 `makoo()` 插件里：

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

这个文件适合放项目级行为：

- `app` 描述 Makoo 应用元信息。
- `entry` 选择 Vite 加载的应用模块。
- Makoo 会补充默认值并规范化支持的 `monkey` 配置，再交给 `vite-plugin-monkey` 处理 userscript 元信息、开发服务和构建行为。

它回答的是“这个项目应该如何运行和构建”。`createMakoo()`、`inject()` 和 `listen()` 用于配置运行时 task 行为。

## 运行时编排

Vue 项目一般可以这样编排多个 task：

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Header from './injections/header/App.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({
		id: 'header',
		injectAt: '#header',
		artifact: Header,
		options: { alive: true, timeout: 5000 }
	})
]);
```

运行时编排主要包括：

- 有哪些 task
- 每个 task 挂载哪个组件
- 每个模块等待哪个 DOM 选择器
- `alive`、`scope`、`timeout`、`hooks` 和事件绑定等 task 选项

`vite.config.ts` 配置工具链，`createMakoo()`、`inject()` 和 `listen()` 提供运行时编排能力。

## Injection Module

注入模块是 userscript 中的一个独立功能或挂载点，可以包含组件、样式和相关业务逻辑。
项目可以按需要组织这些代码，例如：

```txt
src/injections
├─ profile-card
│  └─ App.vue
└─ react-badge
   ├─ App.tsx
   └─ style.css
```

Task id 由 `inject()` 显式声明：

```ts
inject({ id: 'profile-card', injectAt: '.profile', artifact: ProfileCard });
```

## Makoo Runtime

`createMakoo()` 创建 Makoo runtime 调度器，并通过 `start(...)` 启动注册的 task。

运行时，Makoo 会做这些事：

- 用 `inject()` 和 `listen()` 声明组件任务和监听器任务
- 等待每个 `injectAt` 选择器出现
- 管理任务的 `idle`、`pending`、`active` 状态
- 调用匹配的 adapter 挂载组件
- 向挂载后的组件暴露 Makoo context
- 在需要时重置或销毁任务
- 在启用 `alive` 时处理宿主目标节点移除后的重新注入

一般项目会导入对应的前端框架 adapter、构造 task 列表，并调用 `makoo.start(tasks)` 启动任务。挂载后的组件
也可以通过 adapter 传入的 `makoo` context 与 runtime 交互。

## Task

Task 是由模块或监听器注册后生成的运行时记录。组件任务里会保存目标选择器、组件 artifact、
adapter、timeout、alive 设置和挂载状态。

任务状态刻意保持简单：

| 状态 | 含义 |
| --- | --- |
| `idle` | 已注册，但当前没有等待或挂载 |
| `pending` | 正在等待目标 DOM 节点 |
| `active` | 已找到目标，并完成模块挂载或监听器绑定 |

你通过 `inject()` 和 `listen()` 配置 task。运行时会用 task 协调 DOM
ready、挂载、监听器和清理行为。

## Adapter

Adapter 是 Makoo 运行时和组件框架之间的桥接层，负责说明：

- 它是否能处理某个组件 artifact
- 如何把这个 artifact 挂载到 Makoo 创建的 mount point
- 在 reset、destroy 或 remount 时如何卸载

Makoo 目前通过 `@makoojs/vue` 和 `@makoojs/react` 提供 Vue / React adapter。

通过 adapter 挂载的组件会收到一个 Makoo context。这个 context 包含 task id、目标选择器、
`reset()`、`destroy()` 等生命周期控制、hook 注册能力、logger 和监听器控制能力。

## Alive 重新注入

`alive` 用于处理宿主目标节点被移除并重新创建的情况。

模块启用 `alive` 后，Makoo 会观察已经匹配的宿主目标节点。该节点被移除后，Makoo 会等待同一
`injectAt` 选择器重新出现并尝试挂载。目标节点的移除观察范围由 `scope` 控制：

| Scope | 含义 |
| --- | --- |
| `local` | 观察目标附近区域 |
| `global` | 观察更大的 document 范围 |

宿主页面会移除并重新创建目标节点时，可以启用 `alive`。目标节点稳定时保持关闭，避免不必要的观察开销。

## Hooks

Hooks 用来观察 Makoo 的生命周期事件。它适合做日志、调试、统计，或者围绕注册、运行、挂载、监听器和
DOM 事件协调一些行为。

Hooks 可以在创建 Makoo 时全局设置，也可以配置到单个 task：

```ts
const makoo = createMakoo({
	hooks: {
		'start:requested': (payload) => console.log(payload)
	}
});

makoo.start([
	inject({
		id: 'panel',
		injectAt: 'body',
		artifact: Panel,
		options: {
			hooks: {
				'artifact:mountSuccess': (payload) => console.log(payload)
			}
		}
	})
]);
```

全局 hooks 适合项目级观察。模块 hooks 更适合只属于某个注入模块的逻辑。

## 这些概念如何配合

各部分的职责如下：

| 层级 | 文件 | 职责 |
| --- | --- | --- |
| 项目配置 | `vite.config.ts` | 应用文件、userscript 元信息、构建与开发选项 |
| Task 编排 | `@makoojs/core` | 创建 runtime、声明 task、启动 Makoo |
| 运行时 | Makoo core | 等待、挂载、重新注入和清理 task |
| 框架桥接 | Vue 或 React adapter | 挂载和卸载框架组件 |

这些部分共同完成 userscript 的配置、任务编排、组件挂载和清理。
