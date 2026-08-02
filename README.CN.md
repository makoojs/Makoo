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

它关注的是油猴脚本、暴力猴脚本和其他 userscript 开发里最容易变乱的那部分：等待目标 DOM、挂载组件、处理页面重绘、按模块管理注入项、在开发时热更新结构变化。构建、元信息和脚本安装流程仍然交给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)，Makoo 在它之上封装了多一层，让 userscript 项目更像一个结构清晰的前端开发框架。

## 什么时候适合使用 Makoo

Makoo 不主张用于简单的 userscript。如果你的脚本只是修改一个按钮、隐藏一个元素，或者注入一段简单样式，直接写原生 userscript 往往已经足够。

Makoo 更适合那些开始像小型前端应用一样运行的 userscript：

- 需要用 Vue 或 React 构建注入式 UI，对现有网页进行改造
- 同一个页面上有多个注入点或多个功能模块
- 宿主页面会重绘、局部刷新，脚本需要稳定重新挂载
- 需要按 URL 或页面状态启用不同模块
- 代码量开始增长，需要清晰的目录、配置和开发工作流

当生命周期、模块边界和长期维护开始变重要时，才是 Makoo 真正适合出场的时候。

## 目录

- [什么时候适合使用 Makoo](#什么时候适合使用-makoo)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [项目结构](#项目结构)
- [配置概览](#配置概览)
- [Manifest 参考](#manifest-参考)
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

一个最小项目包含：

```txt
.
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   └─ hello-world
      └─ app.vue
```

## 核心概念

`createMakoo()` 会创建 Makoo 的运行时调度器。它负责启动声明式注入任务、等待目标节点、调用对应适配器挂载组件，并在需要时处理重注入。

`Injection Module` 是一个注入模块。一个模块通常对应 `injections/<module-name>/` 下的一个组件，也可以有自己的模块级 `manifest.ts` 覆盖配置。

`Manifest` 是声明式注入配置。顶层 `injections/manifest.ts` 描述项目里有哪些模块要注入；模块级 `injections/foo/manifest.ts` 可以为同一模块中根manifest缺失的字段进行补充，其中模块manifest中的显式字段优先。

`Adapter` 是组件挂载适配器。Makoo 通过 `@makoojs/vue` 和 `@makoojs/react` 支持 Vue / React，后续也可以扩展其他可挂载产物。

## 项目结构

推荐把所有注入模块放在 `injections/` 下：

```txt
injections
├─ manifest.ts
├─ profile-card
│  ├─ app.vue
│  └─ manifest.ts
└─ react-badge
   ├─ app.tsx
   └─ manifest.ts
```

顶层 `manifest.ts` 适合声明项目入口配置；模块级 `manifest.ts` 适合让模块自己维护 `injectAt`、`framework`、`match`、`hooks` 等配置。

Makoo 会扫描这些 manifest 并自动生成运行时入口，普通项目不需要为了导入 manifest 或启动 Makoo 再创建 `main.ts`。

## 配置概览

Makoo 的 Vite 插件配置由四部分组成：

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1'
	},
	source: {
		include: ['*'],
		exclude: []
	},
	monkey: {
		userscript: {
			match: ['https://example.com/*']
		}
	}
});
```

`app` 用来生成 userscript 元信息里的名称、版本和描述。

`source` 控制 Makoo 从哪里扫描注入模块。当前 `include` / `exclude` 是模块目录扫描过滤，不是 URL 路由匹配。

大多数 `monkey` 配置会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)，用于配置 userscript 元信息、开发服务和构建行为。Makoo 会内部管理 `clientAlias` 和 `server.mountGmApi`，因此这两个选项不支持用户配置。

## Manifest 参考

顶层 manifest 支持数组和对象两种写法。

`injectionDefaults` 用来定义共享运行时默认值。模块会继承 `alive`、`scope`、`timeout` 等标量选项；其中的 `hooks` 会注册为共享运行时 hooks。

`defineInjection`/`defineInjections` 函数和相关类型从 `@makoojs/cli/manifest` 导入。Manifest 会在 Node 构建期被扫描，其中的 hooks、callback 和 activitySignal 会随 userscript 一起打包到浏览器中执行。Manifest 顶层不能产生应用副作用或依赖 Node-only 模块；这些函数引用的其他文件也必须能被浏览器打包。

对象写法适合多数项目：

```ts
import { defineInjections } from '@makoojs/cli/manifest';

export default defineInjections({
	injectionDefaults: {
		alive: false,
		scope: 'local'
	},
	injections: {
		header: {
			injectAt: '#header',
			component: './header/app.vue',
			framework: 'Vue'
		},
		badge: {
			injectAt: 'body',
			component: './badge/app.tsx',
			framework: 'React',
			match: {
				include: ['https://example.com/profile/*'],
				exclude: ['https://example.com/profile/settings']
			}
		}
	}
});
```

数组写法适合动态生成或需要显式 `name` 的场景：

```ts
import { defineInjections } from '@makoojs/cli/manifest';

export default defineInjections({
	injections: [
		{
			name: 'header',
			injectAt: '#header',
			component: './header/app.vue',
			framework: 'Vue'
		}
	]
});
```

常用模块字段：

| 字段 | 说明 |
| --- | --- |
| `injectAt` | 注入目标选择器 |
| `component` | 相对于 `injections/manifest.ts` 或模块目录的组件路径 |
| `framework` | `Vue`、`React` 或 `auto`，不写时会从组件扩展名推断 |
| `enabled` | 是否启用该模块，默认 `true` |
| `alive` | 是否在目标 DOM 变化后尝试重注入 |
| `scope` | 重注入观察范围，支持 `local` / `global` |
| `timeout` | 等待目标节点的超时时间 |
| `hooks` | 当前模块的生命周期钩子 |
| `match` | 当前模块的 URL 匹配规则 |

`injectAt` 必须是 CSS 选择器，不支持使用 `document` 或 `window` 作为注入目标。

模块级 URL `match` 支持简写和完整写法：

```ts
match: ['https://example.com/*']
```

```ts
match: {
	include: ['https://example.com/*'],
	exclude: ['https://example.com/admin/*']
}
```

没有配置 `match` 时，模块会在 userscript 生效的页面上正常注册；配置 `match` 后，Makoo 会在运行时根据 `location.href` 判断是否注册该模块。

### 独立 Listener

顶层 `listeners` 用于声明不归属任何 injection 模块的事件任务。它不需要组件目录，也不需要 framework adapter。对象形式中的键会成为 listener 的任务 ID：

```ts
export default defineInjections({
	listeners: {
			escapeClose: {
				listenAt: 'body',
				type: 'keydown',
				capture: true,
				callback: (event) => {
				if (event instanceof KeyboardEvent && event.key === 'Escape') console.log('close');
			},
			match: ['https://example.com/*']
		}
	}
});
```

Makoo 会为该条目生成 `listen({ id: 'escapeClose', ... })`。listener 也支持 `enabled`、`capture`、`activitySignal` 和与模块相同的 `match` 规则。`capture` 默认为 `false`，设置为 `true` 后会在 DOM 捕获阶段监听事件；数组形式需要用 `name` 提供稳定 ID。`listenAt` 必须是 CSS 选择器，不支持使用 `document` 或 `window` 作为监听目标。

独立 listener 只能声明在顶层 manifest。模块级 manifest 只描述一个 injection 模块，当前尚不支持描述一个listener；事件属于组件任务时使用模块的 `on` 字段。

## HMR 行为说明

Makoo 在开发模式下会区分结构变化和普通组件变化。

| 变化 | 行为 |
| --- | --- |
| 顶层 `injections/manifest.ts` 修改 | 重新扫描并更新虚拟入口 |
| 模块级 `injections/foo/manifest.ts` 修改 | 重新扫描并更新虚拟入口 |
| manifest 通过相对路径引入的 hooks、callback、activitySignal 或它们继续导入的本地文件的修改 | 递归追踪依赖并触发重新扫描 |
| 新增或删除模块级 `manifest.ts` | 触发结构更新 |
| 普通组件文件修改 | 交给 Vite 原生 HMR |
| 第三方包依赖变化 | 不纳入 Makoo 的结构扫描 |

如果你把 hooks 拆到单独文件里，推荐使用静态相对路径导入：

```ts
import { hooks } from './hooks';
```

Makoo 会继续追踪 hooks 和 callback 文件里面的静态导入。动态 `import()`、path alias 和第三方包不会被纳入 Makoo 的结构依赖追踪。

也可以在manifest文件直接写 hooks、callback 和 activitySignal等，也可以使用当前文件里已有的函数，或者使用从其他文件导入的函数等。

## 使用示例

### 按 URL 启用模块

```ts
import { defineInjections } from '@makoojs/cli/manifest';

export default defineInjections({
	injections: {
		profile: {
			injectAt: '#app',
			component: './profile/app.vue',
			match: {
				include: ['https://example.com/users/*'],
				exclude: ['https://example.com/users/settings']
			}
		}
	}
});
```

### 使用 Vue 模块

```ts
import { defineInjections } from '@makoojs/cli/manifest';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			framework: 'Vue'
		}
	}
});
```

### 拆分 hooks

```ts
// injections/hooks.ts
export const hooks = {
	'start:start': () => {
		console.log('[makoo] injector started');
	}
};
```

```ts
// injections/manifest.ts
import { hooks } from './hooks';
import { defineInjections } from '@makoojs/cli/manifest';

export default defineInjections({
	injectionDefaults: {
		hooks
	},
	injections: {
		'hello-world': {
			injectAt: 'body',
			component: './hello-world/app.vue'
		}
	}
});
```

### 使用 `externalGlobals` 减小包体积

`monkey.build.externalGlobals` 和 `externalResource` 会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)：

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: makoo({
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
});
```

### 使用 GM API

Makoo 提供 `@makoojs/cli/monkey` 作为 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM API 的稳定入口。推荐按能力导入，这样最终脚本只会引用实际使用到的 GM 能力：

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

也可以使用聚合入口。如果希望生成的 `@grant` 范围尽量小，优先使用按能力导入；`GMapi` 更适合作为共享代码或探索阶段的便利入口：

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
| `@makoojs/cli` | Vite 插件、配置解析、扫描、代码生成 |
| `@makoojs/create-makoo` | 项目脚手架 |

大多数 userscript 项目优先使用 `@makoojs/cli`。只有自定义运行时集成时，才需要直接接触 `@makoojs/core`、`@makoojs/vue` 或 `@makoojs/react`。

## 特别感谢

Makoo 的开发离不开这些优秀的开源项目：

| 项目 | 说明 |
| --- | --- |
| [Vite](https://vite.dev/) | 提供现代前端开发与构建能力 |
| [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) | 提供 userscript 构建、元信息生成和开发流程支持 |
| [Vue](https://vuejs.org/) | 提供 Vue 组件生态与运行时能力 |
| [React](https://react.dev/) | 提供 React 组件生态与运行时能力 |
| [Vitest](https://vitest.dev/) | 提供测试框架 |
| [jiti](https://github.com/unjs/jiti) | 支持加载 TypeScript manifest 配置 |
| [picomatch](https://github.com/micromatch/picomatch) | 支持模块目录匹配 |

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
