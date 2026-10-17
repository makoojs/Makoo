# 接入已有项目

本页适用于已经有 Vite 项目、想加入 Makoo 的情况。新项目请直接用[快速开始](./getting-started.md)中的脚手架。

前提：项目使用 ESM（`package.json` 中有 `"type": "module"`），Node.js 为 20.19 及以上的 20.x，或 22.12 及以上（21.x 不支持）。

版本要求：`vite` 8.2.2 及以上的 8.x，`vue` 3.3 及以上，`react` 与 `react-dom` 19 及以上。

## 1. 安装依赖

::: code-group
```sh [Vue]
pnpm add @makoojs/core @makoojs/vue vue
pnpm add -D @makoojs/cli vite @vitejs/plugin-vue typescript
```
```sh [React]
pnpm add @makoojs/core @makoojs/react react react-dom
pnpm add -D @makoojs/cli vite @vitejs/plugin-react typescript @types/react @types/react-dom
```
:::

## 2. 配置 Vite

在 `vite.config.ts` 中加入 `makoo()`。下面是 Vue 项目的配置，React 项目把 `vue()` 换成 `@vitejs/plugin-react` 的 `react()`：

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { makoo, makooDev } from '@makoojs/cli';

export default defineConfig({
  plugins: [
    vue(),
    makoo({
      entry: './src/main.ts',
      app: { name: 'my-script', version: '0.0.1' },
      monkey: { userscript: { match: ['https://example.com/*'] } }
    }),
    makooDev()
  ]
});
```

`makooDev()` 是可选的，用于在开发终端查看注入状态，见[本地开发](./development.md)。字段说明见[项目配置](./configuration.md)。

`vite.config.ts` 运行在 Node 中。`document`、GM API 等浏览器代码只能写在入口及其导入的模块里。

## 3. 添加项目命令

在 `package.json` 的 `scripts` 中加入：

```json
{
  "dev": "makoo dev",
  "build": "makoo build",
  "preview": "makoo preview"
}
```

## 4. 编写入口

创建 `src/main.ts`：

::: code-group
```ts [Vue]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './App.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({ name: 'app', injectAt: 'body', adapter: 'vue', component: App })
]);
```
```ts [React]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import App from './App';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'app', injectAt: 'body', adapter: 'react', component: App })
]);
```
:::

TypeScript 项目还需要在一个被 `tsconfig` 包含的声明文件（例如 `src/vite-env.d.ts`）中引用 Vite 的类型声明，以便导入图片等资源：

```ts
/// <reference types="vite/client" />
```

## 5. 运行

```sh
pnpm dev
```

从终端打印的地址安装开发脚本，再打开 `@match` 匹配的网页，组件应出现在页面上。没有出现时，按[常见问题](./troubleshooting.md)逐步检查。
