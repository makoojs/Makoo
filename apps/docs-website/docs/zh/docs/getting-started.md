# 快速开始

这一章会带你创建一个 Makoo 项目、启动开发服务，并修改第一个注入模块。完成后，你会得到一个能把
Vue 或 React 组件挂载到目标页面里的 userscript 项目。

## 创建项目

运行脚手架命令：

```bash
pnpm dlx @makoojs/create-makoo
```

脚手架会依次询问项目名、userscript 元信息、匹配 URL、语言类型和框架。匹配 URL 会成为
userscript 的 `@match` 规则，所以这里应该填写你准备测试第一个注入模块的页面。

例如：

```txt
Project name: makoo-project
Userscript name: makoo-project
Version: 0.0.1
Namespace: npm/makoo
Match URL(s): https://example.com/*
Variant: TypeScript
Framework: Vue
```

## 项目结构

一个新的 Vue 项目通常长这样：

```txt
.
├─ assets
│  ├─ makoo-icon-transparent.png
│  └─ vue.svg
├─ package.json
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   └─ hello-world
      └─ app.vue
```

React 项目结构类似，只是组件文件会变成 `app.tsx`，并带有模块样式文件：

```txt
.
├─ assets
│  ├─ makoo-icon-transparent.png
│  └─ react.svg
├─ package.json
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   └─ hello-world
      ├─ app.tsx
      └─ style.css
```

最重要的是 `injections/` 目录。Makoo 会扫描这里，读取 manifest，并生成运行时入口来注册你的模块。

## 配置 userscript

生成的 `vite.config.ts` 中会包含 Makoo 插件：

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			app: {
				name: 'makoo-project',
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

`app` 字段提供 Makoo 层面的项目信息。`monkey.userscript` 会透传给 `vite-plugin-monkey`，
并成为 userscript 元信息，例如 `@name`、`@namespace` 和 `@match`。

开发时，`match` 应该覆盖你正在测试的页面。如果脚本管理器没有在当前页面运行脚本，Makoo
也就无法在这个页面注册注入模块。

## 定义第一个注入任务

生成的 manifest 会注册一个 `hello-world` 模块：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		'hello-world': {
			injectAt: 'body',
			component: './hello-world/app.vue'
		}
	}
});
```

每个 entry 都描述一个注入模块：

| 字段 | 含义 |
| --- | --- |
| `hello-world` | 模块名 |
| `injectAt` | 目标节点的 CSS 选择器 |
| `component` | 相对于 manifest 的组件路径 |

当目标节点出现后，Makoo 会把组件挂载到这个节点上。脚手架默认使用 `injectAt: 'body'`，
这样在大多数匹配页面上都能直接看到 demo。

## 修改注入目标

如果要挂载到页面中更具体的位置，可以修改 `injectAt`：

```ts
export default defineInjections({
	injections: {
		toolbar: {
			injectAt: '#toolbar',
			component: './toolbar/app.vue'
		}
	}
});
```

然后创建对应的模块目录：

```txt
injections
├─ manifest.ts
└─ toolbar
   └─ app.vue
```

React 项目则使用 `app.tsx`：

```ts
export default defineInjections({
	injections: {
		toolbar: {
			injectAt: '#toolbar',
			component: './toolbar/app.tsx'
		}
	}
});
```

Makoo 可以从组件扩展名推断框架。你也可以显式写上 `framework: 'Vue'` 或
`framework: 'React'`，让 manifest 更清楚。

## 在浏览器中测试

启动开发服务：

```bash
pnpm dev
```

打开命令输出中的开发 userscript 地址，把它安装到你的脚本管理器里，然后访问一个匹配
`monkey.userscript.match` 规则的页面。生成的 `hello-world` 组件应该会出现在页面上。

开发服务运行时：

- 修改 Vue 或 React 组件会走 Vite 原生 HMR
- 修改 `injections/manifest.ts` 会触发 Makoo 的结构更新流程
- 修改 userscript 的 `match` 规则后，可能需要在脚本管理器中重新安装或刷新开发脚本

## 下一步

继续阅读 [核心概念](./concepts.md)，理解 injector、模块、manifest 和 adapter 如何配合。之后可以在
[Manifest 参考](./manifest.md) 中查询 `match`、`alive`、`timeout`、`scope`、生命周期 `hooks`
等模块级配置。
