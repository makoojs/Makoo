# 快速开始

在本教程中，你会创建一个 Makoo 项目，把开发脚本安装到浏览器，并看到第一个组件出现在网页上。大约需要 10 分钟。

## 1. 准备环境

- Node.js 20.19 及以上的 20.x，或 22.12 及以上；以及 pnpm。
- 浏览器中安装并启用一个脚本管理器，例如 Tampermonkey、Violentmonkey 或 ScriptCat。
- 一个用来测试的网页。本教程使用 `https://example.com/`。

## 2. 创建项目

```sh
pnpm dlx @makoojs/create-makoo
```

按提示依次填写：

| 提示 | 本教程填写 |
| --- | --- |
| Project name | `makoo-project` |
| Userscript name | 保持默认 |
| Version | 保持默认 `0.0.1` |
| Namespace | 保持默认 `npm/makoo` |
| Match URL(s) | `https://example.com/*` |
| Variant | TypeScript |
| Framework | Vue 或 React，任选其一 |

最后的 `Install with pnpm and start now?` 选择确认，脚手架会安装依赖（这一步不会启动开发服务）。然后进入项目目录，启动开发服务：

```sh
cd makoo-project
pnpm dev
```

如果创建时没有安装依赖，先运行 `pnpm install`。

## 3. 安装开发脚本

终端会打印一个本地地址。在浏览器中打开它，脚本管理器会弹出安装页，确认安装。

然后访问 `https://example.com/`，页面中央会出现一个带计数按钮的 Makoo 卡片。

安装页和目标网页是两个地方：前者只用来安装脚本，后者才是组件运行的位置。开发期间保持 `pnpm dev` 运行。

没有看到卡片时，先确认地址栏的网址匹配 `https://example.com/*`，再查看浏览器控制台。更多排查步骤见[常见问题](./troubleshooting.md)。

## 4. 修改组件

打开 `src/injections/hello-world/App.vue`（React 项目为 `App.tsx`），把标题 `Makoo` 改成 `Hello Makoo`，保存。

回到目标网页，标题会随之更新。Vue 组件会就地更新、保留计数；React 组件通常也会就地更新。

## 5. 看懂入口

打开 `src/main.ts`：

::: code-group
```ts [Vue]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './injections/hello-world/App.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({
    name: 'hello-world',
    injectAt: 'body',
    adapter: 'vue',
    component: App,
  }),
]);
```
```ts [React]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import App from './injections/hello-world/App.tsx';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({
    name: 'hello-world',
    injectAt: 'body',
    adapter: 'react',
    component: App,
  }),
]);
```
:::

这四行完成了全部工作：

1. `createMakoo()` 创建一个 Core 实例。
2. `useAdapter()` 注册框架适配器，让实例能挂载 Vue 或 React 组件。
3. `inject()` 声明一个名为 `hello-world` 的组件：挂载到 `body`，使用 `App`。
4. `apply()` 把声明交给实例。实例找到 `body`，创建一个容器，再把组件挂载进去。

## 你完成了什么

你创建了项目，安装了开发脚本，在真实网页上运行了一个组件，并看到修改实时生效。

## 下一步

- [教程：可开关的工具面板](./tutorial.md)：给组件加上关闭按钮和对网页元素的监听。
- [核心概念](./concepts.md)：理解实例、声明和注入之间的关系。
- [构建与预览](./build.md)：生成可以分发的 `.user.js`。
