<p align="center">
  <img width="250"  src="./apps/docs-website/docs/public/makoo-icon-transparent.png">
</p>

<h1 align="center">Makoo</h1>
<p align="center">面向油猴 / 暴力猴 / ScriptCat 的 userscript 开发框架</p>

<div align="center">
  <a href="https://github.com/makoojs/Makoo/"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/makoojs/Makoo?style=flat-square"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</div>

<div align="center">
  <a href="./README.md">English</a> | 中文
</div>

---

Makoo 是一个面向 userscript 的开发框架，用来为 Tampermonkey（油猴）、Violentmonkey（暴力猴）、ScriptCat 等浏览器脚本管理器构建可维护的 Vue / React 注入式应用。

它关注的是油猴脚本、暴力猴脚本和其他 userscript 开发里最容易变乱的那部分：等待目标 DOM、挂载组件、在宿主目标节点被移除后重新注入，以及编排多个注入任务。构建、元信息和脚本安装流程由 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 处理，Makoo 提供组件注入所需的运行时编排和 adapter 集成。

## 什么时候适合使用 Makoo

Makoo 不主张用于简单的 userscript。如果你的脚本只是修改一个按钮、隐藏一个元素，或者注入一段简单样式，直接写原生 userscript 往往已经足够。

Makoo 更适合那些开始像小型前端应用一样运行的 userscript：

- 需要用 Vue 或 React 构建注入式 UI，对现有网页进行改造
- 同一个页面上有多个注入点或多个功能模块
- 宿主目标节点会被移除并重新创建，脚本需要重新注入组件
- 需要按 URL 或页面状态启用不同模块
- 代码量开始增长，需要清晰的目录、配置和开发工作流

当生命周期、模块边界和长期维护开始变重要时，才是 Makoo 真正适合出场的时候。

## 目录

- [什么时候适合使用 Makoo](#什么时候适合使用-makoo)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [项目结构](#项目结构)
- [配置概览](#配置概览)
- [运行时编排](#运行时编排)
- [HMR 行为说明](#hmr-行为说明)
- [使用示例](#使用示例)
- [包说明](#包说明)
- [特别感谢](#特别感谢)
- [开发](#开发)
- [许可证](#许可证)

## 快速开始

推荐通过脚手架创建项目：

```bash
pnpm dlx @makoojs/create-makoo
```

创建后进入项目并启动开发服务：

```bash
pnpm install
pnpm dev
```

项目中会包含 Vite 配置、应用代码和示例 injection。

## 核心概念

`createMakoo()` 会创建 Makoo 的运行时调度器。它负责启动声明式注入任务、等待目标节点、调用对应适配器挂载组件，并在需要时处理重注入。

`Injection Module` 表示一个独立的注入功能或挂载单元，可以包含组件、样式和相关业务逻辑。

`Task` 是运行时任务。`inject()` 声明组件注入任务，`listen()` 声明事件监听任务；应用组合这些任务并交给 `makoo.start()`。

`Adapter` 是组件挂载适配器。Makoo 通过 `@makoojs/vue` 和 `@makoojs/react` 支持 Vue / React，后续也可以扩展其他可挂载产物。

## 项目结构

项目可以按需要组织注入相关代码，例如：

```txt
src/injections
├─ profile-card
│  ├─ App.vue
│  └─ style.css
└─ react-badge
   ├─ App.tsx
   └─ style.css
```

`createMakoo()`、`inject()` 和 `listen()` 提供运行时编排能力，相关代码可以按项目习惯组织。

## 配置概览

Makoo 的 Vite 插件配置只描述构建工具链：

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

`app` 用来生成 userscript 元信息里的名称、版本和描述。

`entry` 指定 Vite 加载的应用文件。这个文件会由 Vite 打包，可以直接导入 Vue、React、组件、store、hooks 和其他浏览器代码。

大多数 `monkey` 配置会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)，用于配置 userscript 元信息、开发服务和构建行为。

## 运行时编排

`@makoojs/core` 提供 `createMakoo()`、`inject()` 和 `listen()`，用于创建 runtime 和声明任务。下面的例子同时包含 Vue 和 React 模块：

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import { createVueAdapter } from '@makoojs/vue';
import Header from './injections/header/App.vue';
import Badge from './injections/badge/App.tsx';

const makoo = createMakoo({
	adapters: [createVueAdapter(), createReactAdapter()],
	defaults: {
		alive: false,
		scope: 'local'
	}
});

const tasks = makoo.start([
	inject({
		id: 'header',
		injectAt: '#header',
		artifact: Header
	}),
	inject({
		id: 'badge',
		injectAt: 'body',
		artifact: Badge,
		options: {
			alive: true,
			timeout: 10_000
		}
	})
]);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

常用 injection 字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定的任务 ID |
| `injectAt` | 注入目标选择器 |
| `artifact` | 由 adapter 挂载的组件或其他产物 |
| `options.alive` | 宿主目标节点被移除后，是否等待同一选择器重新出现并重注入 |
| `options.scope` | alive 对宿主目标节点的移除观察范围，支持 `local` / `global` |
| `options.timeout` | 等待目标节点的超时时间 |
| `options.hooks` | 当前任务的生命周期钩子 |
| `options.on` | 归属于当前组件任务的 listener 声明 |

`injectAt` 必须是 CSS 选择器，不支持使用 `document` 或 `window` 作为注入目标。

### 独立 Listener

`listen()` 用于声明不归属任何 injection 模块的事件任务。它不需要组件目录，也不需要 framework adapter：

```ts
import { listen } from '@makoojs/core';

const escapeClose = listen({
	id: 'escape-close',
	listenAt: 'body',
	type: 'keydown',
	capture: true,
	callback: (event) => {
		if (event instanceof KeyboardEvent && event.key === 'Escape') console.log('close');
	}
});
```

listener 支持 `capture` 和 `activitySignal`。`capture` 默认为 `false`，设置为 `true` 后会在 DOM 捕获阶段监听事件。`listenAt` 必须是 CSS 选择器，不支持使用 `document` 或 `window` 作为监听目标。

## HMR 行为说明

使用 HMR 时，在 `import.meta.hot.dispose` 中调用本次 `start()` 返回值的 `destroyAll()`，避免旧任务和新任务同时存在。

## 使用示例

### 按 URL 启用模块

```ts
const isProfilePage = location.pathname.startsWith('/users/') &&
	location.pathname !== '/users/settings';

if (isProfilePage) {
	makoo.start([
		inject({ id: 'profile', injectAt: '#app', artifact: Profile })
	]);
}
```

### 使用 Vue 模块

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './injections/panel/App.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({ id: 'panel', injectAt: 'body', artifact: Panel })
]);
```

### 拆分 hooks

```ts
// src/hooks.ts
export const hooks = {
	'start:requested': () => {
		console.log('[makoo] start requested');
	}
};
```

```ts
// src/main.ts
import { hooks } from './hooks';
import { createMakoo, inject } from '@makoojs/core';
import App from './injections/hello-world/App.vue';

const makoo = createMakoo({ hooks });
makoo.start([
	inject({ id: 'hello-world', injectAt: 'body', artifact: App })
]);
```

### 使用 `externalGlobals` 减小包体积

`monkey.build.externalGlobals` 和 `externalResource` 会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)：

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';
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
				build: {
					externalGlobals: {
						vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js')
					}
				}
			}
		})
	]
});
```

### 使用 GM API

Makoo 通过 `@makoojs/cli/monkey` 提供稳定的 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM API 导入路径。推荐按能力导入，这样最终脚本只会引用实际使用到的 GM 能力：

```ts
import { gmRequest, gmStorage, gmStyle } from '@makoojs/cli/monkey';

gmStyle.add('.makoo-panel { z-index: 999999; }');

gmStorage.set('token', 'abc');
const token = gmStorage.get<string>('token');

gmRequest.get('https://api.example.com/data', {
	responseType: 'json',
	onload(event) {
		console.log(event.response);
	}
});
```

也可以使用聚合导入。如果希望生成的 `@grant` 范围尽量小，优先按能力导入；`GMapi` 适合共享代码或探索阶段：

```ts
import { GMapi } from '@makoojs/cli/monkey';

GMapi.storage.set('enabled', true);
```

当 `monkey.build.autoGrant` 开启时，`@grant` 会继续由 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 根据最终代码自动生成；该选项默认开启。开发期也不需要手动开启全局 `GM_*`。

## 包说明

| 包 | 职责 |
| --- | --- |
| `@makoojs/core` | 框架无关的注入运行时 |
| `@makoojs/vue` | Vue 挂载适配器 |
| `@makoojs/react` | React 挂载适配器 |
| `@makoojs/cli` | Vite 插件、userscript 配置与 CLI 命令 |
| `@makoojs/create-makoo` | 项目脚手架 |

一般项目使用 `@makoojs/cli` 接入 Vite 和 userscript 工具链，同时通过 `@makoojs/core` 编排任务，并按组件类型使用 `@makoojs/vue` 或 `@makoojs/react` adapter。

## 特别感谢

Makoo 的开发离不开这些优秀的开源项目：

| 项目 | 说明 |
| --- | --- |
| [Vite](https://vite.dev/) | 提供现代前端开发与构建能力 |
| [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) | 提供 userscript 构建、元信息生成和开发流程支持 |
| [Vue](https://vuejs.org/) | 提供 Vue 组件生态与运行时能力 |
| [React](https://react.dev/) | 提供 React 组件生态与运行时能力 |
| [Vitest](https://vitest.dev/) | 提供测试框架 |

## 开发

```bash
pnpm install
pnpm build
pnpm test
```

常用命令：

| 命令 | 说明 |
| --- | --- |
| `pnpm build` | 构建所有 package |
| `pnpm test` | 运行测试 |
| `pnpm docs:dev` | 启动文档站 |
| `pnpm docs:build` | 构建文档站 |
| `pnpm lint:fix` | 运行 Biome 检查并修复 |

## 许可证

[MIT](./LICENSE)
