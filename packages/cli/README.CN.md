# @makoojs/cli

`@makoojs/cli` 提供 Makoo 的 Vite 插件和 CLI 命令，并通过 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 提供 userscript 的开发与构建能力。

应用代码通过 `@makoojs/core` 的 `createMakoo()`、`inject()` 和 `listen()` 编排运行时行为；`@makoojs/cli` 负责 Vite 和 userscript 构建部分。

## 适用场景

- 使用 Vite 开发 Makoo userscript 项目。
- 通过 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 生成 userscript 元信息、开发入口和构建产物。
- 使用 `makoo dev` 和 `makoo build` 命令。
- 通过 `@makoojs/cli/monkey` 使用 GM API 的 Makoo 稳定入口。

## 安装

```bash
# npm install @makoojs/cli
# yarn add @makoojs/cli
pnpm add @makoojs/cli
```

如果你使用 `@makoojs/create-makoo` 创建项目，通常会自动配置好 `@makoojs/cli`。

## 最小 Vite 配置

在 Vite 配置中使用 `makoo()`：

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/app.ts',
			app: {
				name: 'my-userscript',
				version: '0.0.1',
				description: 'My first Makoo script'
			},
			monkey: {
				userscript: {
					namespace: 'https://example.com',
					// 这里只是示例，请替换为 userscript 实际支持的页面。
					match: ['https://www.google.com/']
				}
			}
		})
	]
});
```

`makoo()` 将配置交给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 完成 userscript 的开发与构建。

## 配置概览

`makoo()` 的主要配置分为三块：

```ts
makoo({
	entry: './src/app.ts',
	app: {
		name: 'my-script',
		version: '0.0.1',
		description: 'demo script'
	},
	monkey: {
		userscript: {
			match: ['https://www.google.com/']
		}
	}
});
```

| 配置 | 说明 |
| --- | --- |
| `entry` | 交给 Vite 构建的应用模块 |
| `app` | 用于生成 userscript 的 `name`、`version`、`description` |
| `monkey` | 大多数配置会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) |

默认情况下，`monkey.build.autoGrant` 为 `true`，[lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 会根据最终代码生成 `@grant`。

## CLI 命令

安装后可以使用 `makoo` 命令：

| 命令 | 说明 |
| --- | --- |
| `makoo dev` | 启动 Vite dev server，并打印本地访问地址 |
| `makoo build` | 执行 Vite build，生成 userscript 构建产物 |

## 使用 GM API

`@makoojs/cli` 提供 `@makoojs/cli/monkey` 子入口，作为 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM API 的 Makoo 稳定封装。

```ts
import { gmStorage, gmStyle } from '@makoojs/cli/monkey';

gmStyle.add('.makoo-panel { z-index: 999999; }');
gmStorage.set('enabled', true);
```

也可以使用聚合入口：

```ts
import { GMapi } from '@makoojs/cli/monkey';

GMapi.storage.set('enabled', true);
```

如果希望生成的 `@grant` 范围尽量小，可以按能力导入。完整 GM API 见 CLI API 文档。

## 减小构建体积

`@makoojs/cli` 重新导出了 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 的 `cdn`。可以配合 `monkey.build.externalGlobals` 使用 CDN 外部依赖，减小 userscript 构建体积。

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			entry: './src/app.ts',
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			monkey: {
				build: {
					externalGlobals: {
						vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js')
					}
				}
			}
		})
	]
});
```

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoojs/cli` | Vite 插件、CLI 命令和 userscript 构建接入 |
| `@makoojs/core` | 框架无关的注入运行时内核 |
| `@makoojs/vue` | Vue adapter 与 Vue 插件注册 |
| `@makoojs/react` | React adapter |
| `@makoojs/create-makoo` | 项目脚手架 |

运行时行为由应用代码通过 `@makoojs/core` 进行编排。
