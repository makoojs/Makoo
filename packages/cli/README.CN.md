# @makoojs/cli

`@makoojs/cli` 是 Makoo 项目的主要入口。它提供 Vite 插件、CLI 命令、manifest 类型辅助、injection 扫描、虚拟入口生成，并把 userscript 的开发、构建和安装流程接到 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)。

如果你在开发普通 Makoo userscript 项目，通常应该从这个包开始。`@makoojs/core` 负责底层注入运行时，`@makoojs/vue` 和 `@makoojs/react` 负责组件挂载适配器，而 `@makoojs/cli` 负责把它们组织进 Vite 和 userscript 构建流程。

## 适用场景

- 使用 Vite 开发 Makoo userscript 项目。
- 从 `injections` 目录扫描注入模块并生成运行时代码。
- 编写 `injections/manifest.ts` 和模块级 `manifest.ts`。
- 通过 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 生成 userscript 元信息、开发入口和构建产物。
- 使用 `makoo dev`、`makoo build`、`makoo add`、`makoo inspect` 等命令。
- 通过 `@makoojs/cli/monkey` 使用 GM API 的 Makoo 稳定入口。

## 安装

```bash
// npm install @makoojs/cli
// yarn add @makoojs/cli
pnpm add @makoojs/cli
```

如果你使用 `@makoojs/create-makoo` 创建项目，通常会自动配置好 `@makoojs/cli`。

## 最小 Vite 配置

`makoo()` 返回一个 Vite plugin 数组，因此在 `plugins` 中通常使用 `...makoo(...)`。

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		...makoo({
			app: {
				name: 'my-userscript',
				version: '0.0.1',
				description: 'My first Makoo script'
			},
			monkey: {
				userscript: {
					namespace: 'https://example.com',
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

`makoo()` 会先注入 Makoo 自己的扫描和虚拟入口插件，再接入 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 负责 userscript 开发与构建。

## 推荐项目结构

Makoo 默认扫描项目根目录下的 `injections` 目录。

```txt
.
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   ├─ profile-card
   │  ├─ app.vue
   │  └─ manifest.ts
   └─ react-badge
      ├─ app.tsx
      └─ manifest.ts
```

顶层 `injections/manifest.ts` 用来声明 manifest 级的注入默认值和模块列表。模块级 `injections/<module>/manifest.ts` 可以覆盖或补充单个模块的配置，适合让模块自己维护 `injectAt`、`component`、`framework`、`match` 或生命周期 hooks。

## Manifest 基础

`@makoojs/cli` 导出 `defineInjections()` 和 `defineInjection()`，用于给 manifest 提供类型约束。

`injectionDefaults` 用来定义当前 manifest 下共享的注入运行时默认值。模块没有显式配置时，会继承这里的 `alive`、`scope`、`timeout` 和 `hooks`；模块自己写了这些字段时，则以模块配置为准。

对象形式适合多数项目：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injectionDefaults: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	injections: {
		profile: {
			injectAt: '#app',
			component: './profile-card/app.vue',
			framework: 'Vue',
			match: {
				include: ['https://example.com/users/*'],
				exclude: ['https://example.com/users/settings']
			}
		},
		badge: {
			injectAt: 'body',
			component: './react-badge/app.tsx',
			framework: 'React'
		}
	}
});
```

数组形式适合动态生成，或需要显式声明 `name` 的场景：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: [
		{
			name: 'profile',
			injectAt: '#app',
			component: './profile-card/app.vue',
			framework: 'Vue'
		}
	]
});
```

模块级 manifest 可以使用 `defineInjection()`：

```ts
import { defineInjection } from '@makoojs/cli';

export default defineInjection({
	injectAt: '#app',
	component: './app.vue',
	framework: 'Vue',
	alive: true
});
```

常用字段：

| 字段 | 说明 |
| --- | --- |
| `injectAt` | 目标 DOM 选择器 |
| `component` | 组件路径，相对于顶层 manifest 或模块目录 |
| `framework` | `Vue`、`React` 或 `auto`；省略时根据文件扩展名推断 |
| `enabled` | 是否启用该模块，默认 `true` |
| `match` | 模块级 URL 匹配规则 |
| `alive` | 目标 DOM 被移除后是否尝试重注入 |
| `scope` | alive 观察范围，支持 `local` 和 `global` |
| `timeout` | 等待目标 DOM 的超时时间 |
| `hooks` | 传给 `@makoojs/core` 的生命周期观察 hooks |

`match` 支持数组简写：

```ts
match: ['https://example.com/*']
```

也支持 include/exclude 对象：

```ts
match: {
	include: ['https://example.com/*'],
	exclude: ['https://example.com/admin/*']
}
```

`match` 是模块级过滤。userscript 本身在哪些页面运行，仍由 `monkey.userscript.match` 等 userscript 元信息决定。

## 配置概览

`makoo()` 的主要配置分为四块：

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1',
		description: 'demo script'
	},
	source: {
		include: ['*'],
		exclude: []
	},
	runtime: {
		setup: ['./injections/vue-setup.ts']
	},
	monkey: {
		userscript: {
			match: ['https://example.com/*']
		}
	}
});
```

| 配置 | 说明 |
| --- | --- |
| `app` | 用于生成 userscript 的 `name`、`version`、`description` |
| `source` | 控制扫描哪些 injection 模块目录 |
| `runtime` | 控制 Makoo 生成入口里的运行时前置 setup import |
| `monkey` | 大多数配置会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) |

`source.include` 和 `source.exclude` 过滤的是 `injections` 下的模块目录名，不是页面 URL。默认 include 是 `['*']`，exclude 是 `[]`。

大多数 `monkey` 配置会透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)，用于 userscript 元信息、开发服务和构建行为。但 Makoo 会内部管理以下字段：

- `entry`：固定为 Makoo 生成的虚拟入口。
- `clientAlias`：固定为 Makoo 内部使用的 GM API alias。
- `server.mountGmApi`：固定由 Makoo 管理，不支持用户配置。

默认情况下，`monkey.build.autoGrant` 为 `true`，[lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 会根据最终代码生成 `@grant`。

## CLI 命令

安装后可以使用 `makoo` 命令：

| 命令 | 说明 |
| --- | --- |
| `makoo dev` | 启动 Vite dev server，并打印本地访问地址 |
| `makoo build` | 执行 Vite build，生成 userscript 构建产物 |
| `makoo add <name>` | 创建新的 injection 模块并更新 manifest |
| `makoo add <name> --framework Vue` | 创建 Vue injection 模块 |
| `makoo add <name> --framework React` | 创建 React injection 模块 |
| `makoo inspect` | 打印解析后的 Makoo 配置和扫描结果 |

`makoo add` 默认使用 React。它会在 `injections/<name>` 下创建组件文件，并把模块记录写入 `injections/manifest.ts`。

## 扫描与生成流程

Makoo 的 Vite 插件会在启动和构建时执行以下流程：

1. 加载 `injections/manifest.ts`。
2. 扫描 `injections` 下符合 `source.include` / `source.exclude` 的模块目录。
3. 读取模块级 `manifest.ts`，并与顶层 manifest 合并。
4. 解析组件路径、模块 ID、framework、match、alive、scope、timeout 等配置。
5. 根据实际使用到的 framework 生成 adapter import。
6. 生成虚拟入口，创建 `Injector`，注册组件并执行 `run()`。
7. 把虚拟入口交给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 打包成 userscript。

如果没有找到顶层 manifest、没有可用注入模块，或无法推断 framework，CLI 会抛出 Makoo 自己的错误类型，方便定位问题。

## HMR 行为

开发模式下，Makoo 会区分结构变化和普通组件更新。

| 变化 | 行为 |
| --- | --- |
| 顶层 `injections/manifest.ts` 修改 | 重新扫描并更新虚拟入口 |
| 模块级 `injections/<module>/manifest.ts` 修改 | 重新扫描并更新虚拟入口 |
| manifest 静态导入的本地 helper 修改 | 追踪依赖并重新扫描更新虚拟入口 |
| 模块目录新增或删除 | 重新扫描并更新虚拟入口 |
| 普通组件文件修改 | 交给 Vite 原生 HMR 处理 |
| 第三方依赖变化 | 不作为 Makoo 结构扫描依赖 |

结构变化会触发虚拟入口更新。普通组件内部变化则保持 Vite 自己的热更新体验。

## Runtime Setup

`runtime.setup` 用来导入一批只负责副作用初始化的运行时文件。它们会在 Makoo 初始化 adapter、注册 injection、执行 `injector.run()` 前进入最终 userscript bundle。

这个能力适合注册 Vue 插件、初始化 GM helper、导入全局样式或执行埋点初始化。

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		...makoo({
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			runtime: {
				setup: ['./injections/vue-setup.ts']
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

```ts
// injections/vue-setup.ts
import { VuePlugin } from '@makoojs/vue';
import router from './router';
import i18n from './i18n';

VuePlugin.usePlugins(router, i18n);
```

`runtime.setup` 支持字符串和字符串数组。相对路径会基于项目根目录解析：

```ts
runtime: {
	setup: [
		'./injections/vue-setup.ts',
		'./injections/gm-setup.ts'
	]
}
```

开发模式下，setup 文件和它静态导入的本地依赖会参与结构更新。修改这些文件时，Makoo 会重新扫描并更新虚拟入口。

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

如果希望生成的 `@grant` 范围尽量小，优先使用按能力导入；`GMapi` 更适合作为共享代码或探索阶段的便利入口。完整 GM API 参考后续会放到独立文档站中。

## 减小构建体积

`@makoojs/cli` 重新导出了 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 的 `cdn` 辅助方法。你可以配合 `monkey.build.externalGlobals` 使用 CDN 外部依赖，减小 userscript 构建体积。

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: makoo({
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
});
```

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoojs/cli` | Vite 插件、CLI 命令、扫描、代码生成和 userscript 构建接入 |
| `@makoojs/core` | 框架无关的注入运行时内核 |
| `@makoojs/vue` | Vue adapter 与 Vue 插件注册辅助 |
| `@makoojs/react` | React adapter |
| `@makoojs/create-makoo` | 项目脚手架 |

`@makoojs/cli` 本身并不是完整的运行时实现，很多功能无法单独存在，需要依赖 `@makoojs/core` 提供的注入调度能力才能真正工作。
