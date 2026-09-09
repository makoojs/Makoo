# CLI 命令

`@makoojs/cli` 提供 `makoo` 命令。项目内通过 scripts 或 `pnpm exec makoo` 调用。使用流程见[本地开发](../docs/development.md)和[构建与预览](../docs/build.md)。

```sh
makoo dev [root]
makoo build [root]
makoo preview [root]
```

`[root]` 是可选的 Vite 项目目录，省略时使用当前工作目录。Makoo 插件自身的相对入口解析见[项目配置](../docs/configuration.md)。

未传入的选项不会覆盖项目配置；明确传入的选项优先。布尔选项要关闭时使用 `--no-...`，同一选项重复传入时取最后一个值。

## 通用参数

| 参数 | 作用 |
| --- | --- |
| `-c, --config <file>` | 指定 Vite 配置文件 |
| `-m, --mode <mode>` | 设置 mode |
| `--base <path>` | 设置公共基础路径 |
| `-l, --logLevel <level>` | info / warn / error / silent |
| `--clearScreen / --no-clearScreen` | 允许或禁止 Vite 清屏 |
| `--configLoader <loader>` | 配置加载方式；由安装的 Vite 版本支持范围决定 |
| `-h, --help` | 查看帮助 |
| `-v, --version` | 查看版本 |

## `makoo dev`

启动开发服务器。以下网络选项写入 Vite 的 `server` 配置。

| 参数 | 作用 |
| --- | --- |
| `--host [host]` | 监听指定地址；不带值时监听所有地址 |
| `--port <port>` | 设置端口 |
| `--open [path] / --no-open` | 启动时打开浏览器路径，或禁用打开 |
| `--strictPort / --no-strictPort` | 端口被占用时是否直接退出 |
| `--cors / --no-cors` | 控制 CORS |
| `--force` | 忽略依赖预打包缓存 |

```sh
pnpm exec makoo dev --port 5174 --no-open
```

## `makoo build`

执行 Vite 构建。以下选项写入 `build` 配置。

| 参数 | 作用 |
| --- | --- |
| `--target <target>` | 构建语法目标 |
| `--outDir <dir>` | 产物目录 |
| `--assetsDir <dir>` | 资源目录 |
| `--assetsInlineLimit <number>` | 资源内联阈值，单位字节 |
| `--sourcemap [output]` | true / false / inline / hidden；不带值等同 true |
| `--minify [minifier] / --no-minify` | 配置压缩；具体压缩器由 Vite 支持范围决定 |
| `--manifest [name]` | 生成构建清单，可指定文件名 |
| `--emptyOutDir / --no-emptyOutDir` | 控制构建时清空产物目录 |
| `-w, --watch` | 监听源码并重新构建 |

```sh
pnpm exec makoo build --mode staging --outDir release --sourcemap --no-minify
```

## `makoo preview`

为已有产物启动预览服务，不执行构建。

| 参数 | 作用 |
| --- | --- |
| `--host [host]` | 监听指定地址；不带值时监听所有地址 |
| `--port <port>` | 设置端口 |
| `--open [path] / --no-open` | 启动时打开浏览器路径，或禁用打开 |
| `--strictPort / --no-strictPort` | 端口被占用时是否直接退出 |
| `--outDir <dir>` | 要预览的构建目录 |

网络选项写入 `preview`，`--outDir` 写入 `build.outDir`。

```sh
pnpm exec makoo preview --outDir release --port 4174
```

## 相关 API

- <span id="makoo">[Vite 插件](./vite.md#makoo)</span>：`makoo()` 与 `makooDev()`；<span id="cdn">[CDN 配置](./vite.md#cdn)</span>。
- <span id="配置类型">配置类型</span>：<span id="makoooptions">[MakooOptions](./vite.md#makoooptions)</span>、<span id="cliconfig">[CliConfig](./vite.md#cliconfig)</span>、<span id="appconfig">[AppConfig](./vite.md#appconfig)</span>、<span id="monkeyconfig">[MonkeyConfig](./vite.md#monkeyconfig)</span>、<span id="monkeyserverconfig">[MonkeyServerConfig](./vite.md#monkeyserverconfig)</span>、<span id="monkeybuildconfig">[MonkeyBuildConfig](./vite.md#monkeybuildconfig)</span>。
- <span id="gm-api">[Userscript API](./monkey.md)</span> 与 <span id="gm-类型">[GM 类型](./monkey.md#gm-类型)</span>。
