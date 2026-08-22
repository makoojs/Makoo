# 配置

Makoo 通过 Vite 插件 `makoo()` 来配置。从而选择应用模块、定义项目元信息，并把 userscript 选项交给 `vite-plugin-monkey`。

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
				version: '0.0.1',
				description: 'Enhance example.com with injected UI'
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

`vite.config.ts` 通过 `makoo()` 配置应用模块、项目元信息和 userscript 选项。`injectAt`、组件、listener 和生命周期行为放在应用代码中。

## 配置分组

| 分组 | 作用 |
| --- | --- |
| `entry` | Vite 与 userscript 构建加载的应用模块 |
| `app` | Makoo 应用元信息，以及默认 userscript 名称和版本 |
| `monkey` | `vite-plugin-monkey` 的 userscript、开发服务和构建配置 |

## `app`

`app` 是必填项。

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
				version: '0.0.1',
				description: 'Optional script description'
			}
		})
	]
});
```

| 字段 | 说明 |
| --- | --- |
| `name` | 必填应用名称，也会作为默认 userscript `name` |
| `version` | 必填版本，也会作为默认 userscript `version` |
| `description` | 可选描述，也会作为默认 userscript `description` |

如果需要更细的控制，可以在 `monkey.userscript` 中覆盖最终 userscript 元信息。

## `monkey`

大多数 `monkey` 配置会透传给 `vite-plugin-monkey`。

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
					namespace: 'npm/makoo',
					match: ['https://example.com/*'],
					grant: ['GM_getValue', 'GM_setValue']
				},
				server: {
					open: true,
					prefix: 'server:'
				},
				build: {
					fileName: 'my-script.user.js',
					metaFileName: true,
					autoGrant: true
				}
			}
		})
	]
});
```

## 默认值

默认值：

| 选项 | 默认值 |
| --- | --- |
| `monkey.align` | `2` |
| `monkey.styleImport` | `true` |
| `monkey.server.prefix` | `'server:'` |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | `false` |
| `monkey.build.autoGrant` | `true` |

## 配置边界

配置分工如下：

| 文件 | 负责 |
| --- | --- |
| `vite.config.ts` | 应用模块、项目元信息、userscript 开发/构建选项 |
| 应用代码 | adapter、task、目标节点和生命周期选项 |
| 功能模块 | 组件代码和样式 |

这个边界能让 Makoo 项目变大后仍然清楚。
