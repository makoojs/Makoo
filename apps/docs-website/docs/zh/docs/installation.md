# 手动接入

本页适用于已经有 Vite 配置、希望加入 Makoo 的项目。新项目可用[脚手架](./getting-started.md)。以下采用 TypeScript；项目需要使用 ESM（`package.json` 中设置 `"type": "module"`）。

## 安装包

按框架选择一组依赖：

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

## 配置 Vite

下面是 Vue 项目的配置：

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

React 项目把 `vue` 的导入和 `vue()` 替换为 `@vitejs/plugin-react` 的 `react()`。`makooDev()` 用于开发时查看 Runtime 任务；不需要任务查看时可以省略。

`vite.config.ts` 运行在 Node 环境；组件和调用 `createMakoo()` 的入口运行在目标网页。请把 `document`、GM API 等浏览器代码放在应用入口及其导入模块中。

## 添加项目命令

在 `package.json` 的 `scripts` 中加入：

```json
{
  "dev": "makoo dev",
  "build": "makoo build",
  "preview": "makoo preview"
}
```

## 创建入口和组件

按照[组件注入](./injection.md)创建 `src/main.ts` 和对应组件。在 `src/vite-env.d.ts` 中加入 Vite 的资源类型声明：

```ts
/// <reference types="vite/client" />
```

运行 `pnpm dev`，从安装入口安装开发脚本，再访问匹配 `@match` 的网页。开发快捷键和任务查看见[本地开发](./development.md)。
