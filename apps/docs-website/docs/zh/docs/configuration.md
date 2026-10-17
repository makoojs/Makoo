# 项目配置

本页说明 `vite.config.ts` 中开发服务和 userscript 的配置。组件和监听写在浏览器入口中，见[挂载组件](./injection.md)。下面是一份 Vue 项目配置，React 项目使用对应的 `react()` 插件：

`vite.config.ts`

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { makoo, makooDev } from '@makoojs/cli';

export default defineConfig({
  server: { port: 5173 },
  build: { outDir: 'dist' },
  plugins: [
    vue(),
    makoo({
      entry: './src/main.ts',
      app: {
        name: 'my-script',
        version: '0.0.1',
        description: 'Tools for example.com'
      },
      monkey: {
        userscript: {
          namespace: 'npm/makoo',
          match: ['https://example.com/*']
        }
      }
    }),
    makooDev()
  ]
});
```

## 应用元信息

`app` 必填，`name`、`version` 分别生成 userscript 的名称与版本，`description` 可选。

`monkey.userscript` 配置 `namespace`、`match`、权限和资源等其他 metadata。

## 页面匹配与元素选择器

`monkey.userscript.match` 决定脚本管理器在哪些网页加载脚本。例如 `https://example.com/*` 匹配该站点页面。`injectAt` 和 `listenAt` 是应用代码中的 CSS 选择器，用来找到页面内的元素。

修改 metadata 后，应确认脚本管理器中的安装信息已更新，见[本地开发](./development.md)。

## 入口和项目目录

`entry` 是应用入口，可以使用绝对路径；相对路径基于 `makoo()` 的 `root`，省略 `root` 时基于进程当前工作目录。

Vite 自身也有 `root`。如果从其他目录启动项目，需要让 Makoo 入口解析和 Vite 项目根目录保持一致。例如配置文件位于项目根目录时，可以用 `fileURLToPath(new URL('.', import.meta.url))` 取得该目录，并同时传给 Vite 和 `makoo()`。

浏览器入口及其导入模块可使用 DOM 和 GM API；不要在 Node 加载的配置文件中执行它们。

## 开发与构建选项

| 设置 | 写在哪里 |
| --- | --- |
| 服务端口、host、strictPort | Vite 的 `server` |
| 构建目录、JS 压缩 | Vite 的 `build` |
| 预览端口、host | Vite 的 `preview` |
| 脚本文件名、metadata 文件、外部依赖 | `makoo()` 的 `monkey.build` |
| 是否自动打开安装页、开发脚本名称 | `makoo()` 的 `monkey.server` |
| 开发终端中的注入状态查看 | 单独添加 `makooDev()` |

source map、资源目录、CORS 等由 vite-plugin-monkey 固定，在 Vite 配置中修改不生效；JS 默认不压缩。见[由 vite-plugin-monkey 决定的设置](../api/vite.md#由-vite-plugin-monkey-决定的设置)。

开发脚本的名称默认是 `server:` 加 `app.name`，例如 `server:my-script`。`monkey.server.prefix` 传函数可以自定义，传字符串会替换整个名称，见[默认值与字段约束](../api/vite.md#默认值与字段约束)。

临时调整可通过命令行参数完成，例如 `pnpm exec makoo dev --port 5174`；没有传入的选项沿用配置。见[CLI 命令](../api/cli.md)。

## 外部依赖与权限

`monkey.build.externalGlobals` 可把依赖配置成脚本外部资源，`cdn` 帮助生成地址。它只在构建时生效，`pnpm dev` 仍使用本地安装的依赖。

`autoGrant` 默认为 `true`。构建时会推导 GM API 所需权限并写入 `.user.js` 的 metadata。开发脚本则固定声明 `@grant *`，所以开发时能用的 GM API，构建后仍要检查产物中的 `@grant`。GM 使用方式见 [Userscript API](../api/monkey.md)。

完整字段、默认值和公开类型见 [Vite 插件参考](../api/vite.md)。
