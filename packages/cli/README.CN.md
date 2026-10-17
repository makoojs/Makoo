# @makoojs/cli

<p>
  <a href="https://www.npmjs.com/package/@makoojs/cli"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/cli?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/zh/api/vite">API 参考</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/cli/README.md">English</a>
</p>

Makoo 的工具链包。它提供 `makoo()` 与 `makooDev()` 两个 Vite 插件、`makoo dev` / `build` / `preview` 命令，以及在脚本中调用 GM API 的 `@makoojs/cli/monkey`。userscript 的元信息、开发服务与构建由 [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 完成。

## 安装

```sh
pnpm add -D @makoojs/cli vite
```

> [!TIP]
> 用 `pnpm dlx @makoojs/create-makoo` 创建的项目已经配置好了它，不需要单独安装。

## 用法

### 配置 Vite

```ts
// vite.config.ts
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
    // 可选：在开发终端查看注入状态
    makooDev()
  ]
});
```

### 开发与构建

```sh
makoo dev       # 启动开发服务，从打印的地址安装开发脚本
makoo build     # 构建出 .user.js
makoo preview   # 预览构建产物
```

### 调用 GM API

在浏览器代码中按能力导入，构建时会只为用到的 API 生成 `@grant`：

```ts
import { gmStorage } from '@makoojs/cli/monkey';

const runs = gmStorage.get<number>('runs', 0) + 1;
gmStorage.set('runs', runs);
```

## 文档

- [Vite 插件](https://makoojs.github.io/Makoo/zh/api/vite)：`makoo()` 的全部配置、默认值与 `makooDev()`。
- [CLI 命令](https://makoojs.github.io/Makoo/zh/api/cli)：各命令的参数。
- [Userscript API](https://makoojs.github.io/Makoo/zh/api/monkey)：`@makoojs/cli/monkey` 导出的 GM API。
- [项目配置](https://makoojs.github.io/Makoo/zh/docs/configuration)：匹配网址、权限与外部依赖的配置方法。
