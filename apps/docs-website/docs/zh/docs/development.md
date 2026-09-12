# 本地开发

开发流程包含两个地方：终端运行 Vite 服务，浏览器中的脚本管理器在匹配网页加载开发脚本。

## 启动服务

```sh
pnpm dev
```

项目需要配置 `"dev": "makoo dev"`。直接使用 CLI 时，也可以运行 `pnpm exec makoo dev --port 5174`。未传入的选项沿用项目配置，完整参数见[CLI 命令](../api/cli.md)。

## 启用任务查看

保留现有 `makoo(...)`，在 `vite.config.ts` 的插件列表中额外添加 `makooDev()`：

`vite.config.ts`

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

React 项目使用 `@vitejs/plugin-react` 的 `react()` 插件。

## 安装与连接

1. 从开发服务的安装入口打开脚本管理器安装页，确认安装开发脚本。
2. 打开匹配 `monkey.userscript.match` 的目标网页。
3. 页面执行 `createMakoo()` 后，启用了 `makooDev()` 的终端会显示 Runtime 连接数量。

修改 `@match` 等元信息后，应在管理器中确认开发脚本信息已更新，必要时重新安装。

## 终端操作

启用 `makooDev()` 且在交互式终端运行时，直接按键执行，不需要 Enter：

| 按键 | 操作 |
| --- | --- |
| `i` | 打开开发脚本安装入口；入口存在时显示 |
| `t` | 任务页与首页切换 |
| `n` | 查看下一个 Runtime 的任务 |
| `l` | 日志页与首页切换 |
| `r` | 重启 Vite 服务，返回首页 |
| `h` | 打开帮助，再按一次回到之前的页面 |
| `Esc` | 帮助页返回之前页面，其他页面回首页 |
| `u` | 回首页查看地址 |
| `o` | 调用 Vite 的浏览器打开操作 |
| `c` | 进入日志页并清屏 |
| `q` / `Ctrl+C` | 退出服务 |

任务页显示当前 Runtime 的任务 ID、类型、状态和目标。一个浏览器连接可以有多个 Runtime。

## 日志与重启

首页和任务页会提示新的开发日志，按 `l` 查看。日志页显示 Vite 和开发工具链的输出；浏览器中的业务 `console.log` 和 Runtime 错误仍到浏览器控制台查看。

按 `r` 重启后，页面重新连接，终端继续显示任务状态。修改应用入口后的更新行为见[热更新](./hmr.md)。

## 非交互输出

输出重定向或在 CI 环境下运行时，连接数量变化和开发日志以普通文本打印。没有添加 `makooDev()` 时使用普通 Vite 开发输出与快捷键，请以终端提示为准。
