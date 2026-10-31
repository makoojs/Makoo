# 本地开发

开发时有两个地方在工作：终端里运行 Vite 开发服务，浏览器里的脚本管理器在匹配的网页上加载开发脚本。本页说明如何连接两者，并在终端查看注入状态。

## 启动开发服务

```sh
pnpm dev
```

项目的 `dev` 脚本应为 `makoo dev`。临时换端口等可以直接传参，例如 `pnpm exec makoo dev --port 5174`；未传入的选项沿用项目配置，全部参数见 [CLI 命令](../api/cli.md)。

## 安装开发脚本

1. 打开终端打印的本地地址，在脚本管理器弹出的页面中确认安装。
2. 打开 `monkey.userscript.match` 匹配的目标网页。

开发脚本从本地开发服务加载代码，所以开发期间要保持 `pnpm dev` 运行。修改 `@match` 等元信息后，请在脚本管理器中确认开发脚本已更新，必要时重新安装。

代码修改后的更新方式见[热更新](./hmr.md)。

## 在终端查看注入状态

在 `vite.config.ts` 的插件列表中，保留 `makoo(...)`，再额外加入 `makooDev()`：

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

脚手架生成的项目默认不包含 `makooDev()`，需要时手动加入。它只在开发服务中生效，不影响构建产物。没有它时，终端只打印 Makoo 的启动信息（版本和访问地址），之后是 Vite 自带的输出和快捷键。加入后，直接用 `vite` 启动也会显示与 `makoo dev` 相同的终端。

页面通过独立的桥接端口上报状态，默认 `9999`。另一个项目的开发服务已经占用它时，终端打印警告且不显示注入，Vite 照常运行；用 `makooDev({ port })` 换一个端口。全部选项见 [`makooDev()`](../api/vite.md#makoodev)。

打开目标网页后，终端首页的 `Runtime` 一行会显示已连接的数量。每个 Core 实例算一个连接，同一个网页中可以有多个。按 `t` 进入注入页：

```text
Runtime 1/1 · Client 1 · Makoo1

Makoo Injections

STATUS        NAME      KIND
● mounted     panel     component
  ● bound       └ site-button  attached listener
● collecting  cards     component each
  ● mounted     └ child #1     child
  ● failed      └ child #2     child
    MAKOO_MOUNT_FAILED: Failed to mount "cards#2"
● failed      shortcut  standalone listener
  MAKOO_TARGET_WAIT_TIMEOUT: Timed out waiting for listener "shortcut"

5 injections · 2 mounted · 1 collecting · 2 failed
```

- 每个顶层注入一行，附属监听缩进显示在所属组件下方。
- `injectEach()` 创建的注入先显示整组状态，下方按文档顺序为每个子注入缩进一行，标为 `child #1`、`child #2` 等。
- 第一行是当前查看的实例序号和连接标识。
- 顶层注入或子注入为 `failed` 时，下一行显示 `lastError` 的错误码和消息，过长时截断。
- 最后一行把顶层注入和子注入一起计数，附属监听不计入。
- 状态订阅者和 `observe()` 回调的异常显示在 `Diagnostics` 一节中，最多保留 5 条。事件处理函数的异常不在这里，请看浏览器控制台。
- 有多个 Core 实例时，按 `n` 切换到下一个。

页面刷新时，旧连接断开、新页面重新连接，终端会自动显示新页面的状态。

`makooDev()` 只读取状态并上报，不会启动、停止或移除注入。浏览器中业务代码的 `console.log` 和完整的错误对象，仍需在浏览器控制台查看。

## 终端快捷键

添加了 `makooDev()` 并在交互式终端中运行时，直接按键即可，不需要回车：

| 按键 | 操作 |
| --- | --- |
| `i` | 打开开发脚本安装页（存在时显示） |
| `t` | 在注入页与首页间切换 |
| `n` | 查看下一个 Core 实例的注入 |
| `l` | 在日志页与首页间切换 |
| `c` | 进入日志页并清屏 |
| `r` | 重启 Vite 服务 |
| `u` | 回到首页查看地址 |
| `o` | 用 Vite 的方式打开浏览器 |
| `h` | 打开帮助，再按一次返回 |
| `Esc` | 帮助页返回上一页，其他页面回到首页 |
| `q` / `Ctrl+C` | 退出 |

首页会提示新的开发日志数量，按 `l` 查看 Vite 和工具链的输出。

## 非交互环境

输出被重定向或在 CI 中运行时，不显示交互页面。添加了 `makooDev()` 时，启动时打印一次首页，之后只以普通文本打印连接数量的变化和开发日志，不输出注入表。
