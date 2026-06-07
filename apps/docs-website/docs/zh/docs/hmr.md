# HMR 行为

Makoo 在开发模式下区分两类更新：

- 普通组件更新，这部分 Vite 已经处理得很好
- 结构更新，这时 Makoo 需要重新扫描 manifest，并重新生成虚拟运行时入口

这个分离能让组件编辑保持快速，同时让 manifest 和模块结构变化也能在开发时生效。

## 更新类型

| 变更 | 行为 |
| --- | --- |
| Vue 或 React 组件文件变化 | 交给 Vite 框架 HMR 处理 |
| 顶层 `injections/manifest.ts` 变化 | Makoo 重新扫描并更新虚拟入口 |
| 顶层 manifest 导入的本地依赖变化 | Makoo 重新扫描并更新虚拟入口 |
| 模块级 `injections/<module>/manifest.ts` 变化 | Makoo 重新扫描并更新虚拟入口 |
| 新增或删除模块级 manifest | Makoo 重新扫描并更新虚拟入口 |
| `runtime.setup` 文件变化 | Makoo 重新扫描并更新虚拟入口 |
| setup 文件导入的本地依赖变化 | Makoo 重新扫描并更新虚拟入口 |
| 第三方包依赖变化 | 不参与 Makoo 结构扫描 |

## 结构更新

结构更新指任何会改变生成注入入口的变化，例如：

- 新增模块级 `manifest.ts`
- 删除模块级 `manifest.ts`
- 修改模块的 `injectAt`
- 修改模块的 `component`
- 切换 `enabled`
- 修改 `match`、`alive`、`scope`、`timeout` 或 `hooks`
- 修改 manifest 导入的本地 helper
- 修改 `runtime.setup` 文件

当 Makoo 检测到结构更新时，会重新扫描项目、使虚拟模块失效，并向 Vite 发送生成入口的 HMR 更新。

## 组件更新

组件文件会刻意交给 Vite 和对应框架插件处理：

```txt
injections
└─ hello-world
   ├─ app.vue       <- Vue HMR
   ├─ app.tsx       <- React HMR
   └─ style.css     <- Vite CSS update
```

修改组件不应该要求 Makoo 重新扫描 manifest。这样日常 UI 迭代会尽量接近默认 Vite 体验。

## 依赖追踪

Makoo 会追踪 manifest 和 setup 文件中的本地静态导入。

```ts
// injections/manifest.ts
import { profileHooks } from './profile-hooks';

export default defineInjections({
	globalInjector: {
		hooks: profileHooks
	},
	injections: {
		profile: {
			injectAt: '.profile',
			component: './profile/app.vue'
		}
	}
});
```

修改 `profile-hooks.ts` 会触发结构更新，因为它是 manifest 的本地依赖。

Makoo 不会追踪所有可能的依赖形态。manifest 和 setup 依赖推荐使用静态相对路径导入：

```ts
import { hooks } from './hooks';
```

Makoo 现在还处于早期，依赖追踪暂时是有意收窄的。请尽量不要依赖以下场景的结构 HMR：

- manifest 依赖链中的动态 `import()`
- Makoo 无法解析为本地文件的 path alias
- manifest helper 导入的第三方包

如果这些依赖会影响生成的运行时，修改后建议重启开发服务。

## 监听范围

开发模式下，Makoo 会监听：

- 已加载的顶层 manifest 文件
- 从顶层 manifest 收集到的本地依赖
- 从 `runtime.setup` 收集到的本地依赖
- 已启用模块的模块级 manifest 文件
- `injections/` 目录，用于发现新增或删除的模块 manifest

它不会把 `injections/` 下的每个文件都当作结构变化。普通组件变化会回到 Vite 原生 HMR 流程。

## 重新扫描错误

如果重新扫描失败，Makoo 会在存在开发服务器时通过 Vite error overlay 显示错误。常见原因包括：

- 缺少 `injections/manifest.ts`
- manifest 结构无效
- 组件文件不存在
- 无法从组件扩展名推断框架
- 过滤后没有任何启用的注入模块
- `runtime.setup` 文件不存在

修复 manifest 或 setup 文件后再次保存，Makoo 会在下一次相关变化时重新扫描。

## 什么时候需要重启

大多数 manifest 和组件修改都不需要重启。以下场景建议重启开发服务：

- 安装或升级依赖
- 修改 Vite 插件
- 修改不受支持的 `vite-plugin-monkey` 集成细节
- manifest 依赖了第三方 helper，并且该 helper 影响生成运行时
- 修改只能通过动态导入或无法解析的 alias 触达的文件

经验规则是：如果变化影响 Vite 本身、包解析，或者 Makoo 无法静态收集的依赖，就重启开发服务。
