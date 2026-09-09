# Vite 插件

在 `vite.config.ts` 中从 `@makoojs/cli` 导入插件。使用步骤见[项目配置](../docs/configuration.md)，终端操作见[本地开发](../docs/development.md)。

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
function makooDev(): Plugin;
```

启用开发时的 Runtime 连接和任务状态查看，无需参数。与 `makoo()` 一起放进 `plugins`，然后用 `makoo dev` 启动。它在开发服务中启用。

`makoo()` 负责 userscript 构建和安装入口；`makooDev()` 负责开发任务查看。两者分别添加。

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
| `monkey.server.prefix` | 'server:' |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | false；true 时由脚本名生成 .meta.js 名称 |
| `monkey.build.autoGrant` | true |

`monkey.userscript` 不接受 `name`、`version`、`description`；这些字段统一通过 `app` 设置。
