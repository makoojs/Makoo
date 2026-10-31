# Vite 插件

在 `vite.config.ts` 中从 `@makoojs/cli` 导入插件。这些代码运行在 Node 中。使用步骤见[项目配置](../docs/configuration.md)，终端操作见[本地开发](../docs/development.md)。

## `makoo()`

根据 Makoo 配置创建 Vite plugins。

### 类型 {#type}

```ts
function makoo(options: MakooOptions): Plugin[];
```

### 参数 {#parameters}

`options` 使用 `MakooOptions`。

### 返回值 {#returns}

返回一个 `Plugin[]`。

### 示例 {#example}

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/main.ts',
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

## `makooDev()`

```ts
function makooDev(options?: MakooDevOptions): Plugin;

type MakooDevOptions = {
	port?: number;
	host?: string;
};
```

在开发终端中显示页面上 Core 实例的连接情况、每个注入的状态和错误。与 `makoo()` 一起放进 `plugins`，用 `makoo dev` 或 `vite` 启动都会接管终端；只在开发服务中生效，不影响构建产物。

页面通过一个独立的桥接服务向终端上报状态，不经过 Vite 的端口：

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `port` | `9999` | 桥接服务的固定端口，1 到 65535 的整数；被占用时不会改用其他端口 |
| `host` | `'127.0.0.1'` | 桥接服务的监听地址，IPv4/IPv6 字面量或 `'localhost'` |

`port` 或 `host` 不合法时，调用 `makooDev()` 就会抛错。开发服务重启前后，桥接地址保持不变。

- 桥接端口被占用时，终端打印警告并且不启动桥接服务；Vite 服务照常运行，终端不会显示注入。用 `makooDev({ port })` 换一个端口。
- `host` 不是本机回环地址时，其他机器也能访问桥接服务，只靠 token 保护，启动时终端会打印警告。
- 不支持中间件模式（`server.middlewareMode`）：插件打印警告，桥接服务和终端都不启动。
- 多次注册 `makooDev()` 时只有第一个生效，并打印警告。

`makooDev()` 只读取状态入口和实例观察并上报，不会启动、停止或移除注入，也不处理热更新。

`makoo()` 负责 userscript 构建和安装入口；`makooDev()` 负责开发时的注入查看。两者分别添加。

## `cdn`

从 `vite-plugin-monkey` 重新导出的 CDN 配置生成器。

### 类型 {#type-1}

```ts
type CdnFactory = (
	exportVarName?: string,
	pathname?: string
) => [string, ModuleToUrlFc];

const cdn: {
	jsdelivr: CdnFactory;
	jsdelivrFastly: CdnFactory;
	unpkg: CdnFactory;
	cdnjs: CdnFactory;
	zhimg: CdnFactory;
	elemecdn: CdnFactory;
	bdstatic: CdnFactory;
	npmmirror: CdnFactory;
	bootcdn: CdnFactory;
	staticfile: CdnFactory;
};
```

`bootcdn` 和 `staticfile` 由 `vite-plugin-monkey` 标记为 deprecated。

## 配置类型

### `MakooOptions`

```ts
type MakooOptions = CliConfig & {
	root?: string;
};
```

### `CliConfig`

```ts
type CliConfig = {
	entry: string;
	app: AppConfig;
	monkey: MonkeyConfig;
};
```

### `AppConfig`

```ts
type AppConfig = {
	name: string;
	version: string;
	description?: string;
};
```

### `MonkeyConfig`

```ts
type MonkeyConfig = {
	userscript?: Omit<MonkeyUserScript, 'name' | 'version' | 'description'>;
	align?: number | false;
	generate?: (options: {
		userscript: string;
		mode: 'serve' | 'build' | 'meta';
	}) => string | Promise<string>;
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};
```

### `MonkeyServerConfig`

```ts
type MonkeyServerConfig = {
	open?: boolean;
	prefix?: string | ((name: string) => string) | false;
};
```

### `MonkeyBuildConfig`

```ts
type MonkeyBuildConfig = {
	fileName?: string;
	metaFileName?: string | boolean | ((fileName: string) => string);
	externalGlobals?: ExternalGlobals;
	autoGrant?: boolean;
	externalResource?: ExternalResource;
	systemjs?: 'inline' | ((
		version: string,
		packageName: string,
		importName?: string,
		resolveName?: string
	) => string);
	cssSideEffects?: string | ((css: string) => void);
};
```

## 默认值与字段约束

| 字段 | 默认值或约束 |
| --- | --- |
| `root` | 当前工作目录 |
| `entry` | 必填；相对 root 解析 |
| `app.name / app.version` | 必填；控制同名 userscript 字段 |
| `app.description` | 可选；控制 userscript description |
| `monkey` | 必填，可传空对象 |
| `monkey.align` | 2 |
| `monkey.styleImport` | true |
| `monkey.server.open` | Windows/macOS 为 true，其他平台为 false |
| `monkey.server.prefix` | `` (name) => `server:${name}` ``；见下方说明 |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | false；true 时把文件名结尾的 `.user.js` 换成 `.meta.js` |
| `monkey.build.autoGrant` | true |

`monkey.server.prefix` 决定开发脚本在脚本管理器中的名称，三种写法效果不同：

| 写法 | 开发脚本名称 |
| --- | --- |
| 函数，包括默认值 | 函数返回值，默认为 `server:my-script` |
| 字符串，例如 `'dev'` | 整个名称被替换为这个字符串 |
| `false` | 与 `app.name` 相同 |

`monkey.userscript` 的类型不包含 `name`、`version`、`description`；运行时传入也会被 `app` 的同名字段覆盖，不会报错。

这些字段只由 TypeScript 类型约束，运行时不做校验；开启类型检查后，`vite.config.ts` 中缺少或拼错的字段会被提示出来。`monkey` 中上面没有列出的字段原样交给 vite-plugin-monkey。

### 由 vite-plugin-monkey 决定的设置

`makoo()` 内部使用 vite-plugin-monkey，它会固定以下设置，Vite 配置和 CLI 参数中的同名值不生效：

- 构建：`build.sourcemap` 为 `false`，`build.assetsDir` 为 `'./'`，资源全部内联，CSS 不拆分。
- 压缩：未设置 `build.minify` 时 JS 不压缩；CSS 默认压缩（`build.cssMinify`）。
- 开发与预览服务：`cors` 固定为 `true`。
- 开发脚本：自动声明 `@grant *`，可以使用全部 GM API；构建产物的 `@grant` 则由 `autoGrant` 按代码推导，两者可能不同。
