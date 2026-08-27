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
│  ├─ makoo-icon.png
│  └─ vue.svg
├─ .gitignore
├─ env.d.ts
├─ package.json
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ src
   ├─ main.ts
   └─ injections
      └─ hello-world
         └─ App.vue
```

React 项目结构类似，只是组件文件会变成 `App.tsx`，并带有模块样式文件：

```txt
.
├─ assets
│  ├─ makoo-icon.png
│  └─ react.svg
├─ .gitignore
├─ env.d.ts
├─ package.json
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ src
   ├─ main.ts
   └─ injections
      └─ hello-world
         ├─ App.tsx
         └─ style.css
```

生成模板通过 `createMakoo()` 和 `inject()` 声明 task 并启动 runtime。示例将功能代码放在 `src/injections/` 下。

## 配置 userscript

生成的 `vite.config.ts` 中会包含 Makoo 插件：

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
				name: 'makoo-project',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					icon: 'https://vitejs.dev/logo.svg',
					namespace: 'npm/makoo',
					match: ['https://example.com/*']
				},
				build: {
					externalGlobals: {
						vue: cdn.jsdelivr('Vue', 'dist/vue.global.min.js')
					}
				}
			}
		})
	]
});
```

`app` 字段提供 Makoo 层面的项目信息。Makoo 会补充默认值并规范化支持的 `monkey`
配置，再交给 `vite-plugin-monkey` 生成 `@name`、`@namespace` 和 `@match` 等元信息。

开发时，`match` 应该覆盖你正在测试的页面。如果脚本管理器没有在当前页面运行脚本，Makoo
也就无法在这个页面注册注入模块。

## 定义第一个注入任务

生成的应用代码会注册一个 `hello-world` task：

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './injections/hello-world/App.vue';

const tasks = createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({ id: 'hello-world', injectAt: 'body', artifact: App })
]);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

这个 task 声明包含以下信息：

| 字段 | 含义 |
| --- | --- |
| `id` | Task id；示例值为 `hello-world` |
| `injectAt` | 目标节点的 CSS 选择器 |
| `artifact` | 导入的组件 |

当目标节点出现后，Makoo 会在该节点下创建 mount point，再由 adapter 把组件挂载到
mount point。脚手架默认使用 `injectAt: 'body'`，这样在大多数匹配页面上都能直接看到 demo。

## 修改注入目标

如果要挂载到页面中更具体的位置，可以修改 `injectAt`：

```ts
inject({ id: 'toolbar', injectAt: '#toolbar', artifact: Toolbar });
```

这个示例把对应组件放在下面的位置：

```txt
src/injections
└─ toolbar
   └─ App.vue
```

React 项目导入 `createReactAdapter()` 和 React 组件：

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Toolbar from './injections/toolbar/App.tsx';

createMakoo({ adapters: [createReactAdapter()] }).start([
	inject({ id: 'toolbar', injectAt: '#toolbar', artifact: Toolbar })
]);
```

## 在浏览器中测试

启动开发服务：

```bash
pnpm dev
```

打开命令输出中的开发 userscript 地址，把它安装到你的脚本管理器里，然后访问一个匹配
`monkey.userscript.match` 规则的页面。生成的 `hello-world` 组件应该会出现在页面上。

修改 userscript 的 `match` 规则后，可能需要在脚本管理器中重新安装或刷新开发脚本。

## 下一步

继续阅读 [核心概念](./concepts.md)，理解 runtime、task、模块和 adapter 如何配合。Core API
中可以查询 `alive`、`timeout`、`scope`、listener 和生命周期 hooks 等 task 配置。
