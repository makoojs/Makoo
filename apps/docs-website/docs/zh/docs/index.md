# 介绍

Makoo 是一个 userscript 开发框架，用于为 Tampermonkey、Violentmonkey、ScriptCat
等浏览器脚本管理器构建可维护的 Vue 和 React 注入应用。

它服务的不是只有几行 DOM 操作的小脚本，而是已经开始像一个小型前端应用的
userscript：需要挂载组件、响应页面重绘、拆分多个功能模块，甚至在不同页面上按规则启用不同注入点。到这个阶段，真正困难的部分不再是写一个组件，而是让整套运行时保持清晰、稳定、可维护。Makoo 就是为这层结构而生的。

## 为什么需要 Makoo

传统 userscript 很容易开始，但项目变大后很难保持整洁。宿主页面可能延迟渲染、替换大段
DOM、不完整刷新页面，或者直接移除你已经挂载过组件的节点。同时，现代脚本项目又往往希望拥有组件化 UI、类型化配置、本地开发体验、热更新，以及能被脚本管理器顺利安装的构建产物。

Makoo 关注的是组件代码和脚本管理器之间的中间层：

- 等待目标 DOM 节点出现后再挂载
- 通过声明式 manifest 注册注入模块
- 通过适配器挂载 Vue 和 React 组件
- 监听页面变化，并在需要时重新注入模块
- 在开发时热更新 manifest 和模块结构变化

构建产物、userscript 元信息、安装行为和脚本管理器集成仍然由 `vite-plugin-monkey`
处理。Makoo 在它之上补上一层项目模型，让组件驱动的 userscript 项目更接近一个结构明确的前端工程。

## 什么时候适合使用

当你的 userscript 已经不只是一次性修改某个元素，而是开始像小型前端应用一样运行时，Makoo
会很适合。

典型场景包括：

- 同一个页面上有多个注入点
- 需要把 Vue 或 React 组件挂载到现有网站里
- 不同页面根据 URL 规则启用不同模块
- 宿主页面重绘或替换内容后需要重新注入
- userscript 代码量增长后，需要稳定的项目结构
- 希望使用 Vite 开发，并让 manifest 与模块结构变化也能热更新

如果只是一个非常小的脚本，只在页面加载后改一次元素，直接写原生 userscript 可能已经足够。
Makoo 的价值会在生命周期、模块边界和长期维护开始变重要时体现出来。

## 心智模型

一个 Makoo 应用由几个小概念组成：

| 概念 | 作用 |
| --- | --- |
| Manifest | 声明有哪些模块、挂载到哪里、什么时候运行 |
| 注入模块 | `injections/` 下一个独立功能或挂载点 |
| Injector | 等待目标、注册任务、挂载模块，并管理重新注入 |
| Adapter | 把 Makoo 的运行时连接到 Vue 或 React 的挂载方式 |
| Vite 插件 | 扫描 manifest、生成虚拟入口，并集成 `vite-plugin-monkey` |

实际使用时，你会在 `injections/manifest.ts` 中描述注入规则，把每个功能放到自己的模块目录里，
再由 Makoo 生成运行时入口，在匹配的页面上完成挂载。

## Makoo 提供什么

- 声明式注入 manifest
- 用于组件挂载的运行时 injector
- DOM 监听和 alive 重新注入
- Vue 和 React 适配器
- 面向开发和构建流程的 Vite 插件集成

## 阅读路线

如果你是第一次使用 Makoo，推荐按这个顺序阅读：

1. [快速开始](./getting-started.md)：创建项目并定义第一个注入任务。
2. [核心概念](./concepts.md)：理解 injector、模块、manifest 和 adapter。
3. [配置](./configuration.md)：了解 Makoo、Vite 和 `vite-plugin-monkey` 如何协作。
4. [Manifest 参考](./manifest.md)：查询模块行为相关的具体字段。
5. [HMR](./hmr.md)：了解开发时哪些变化会自动更新。
6. [使用示例](./recipes.md)：直接套用常见模式。

## 快速开始预览

```bash
pnpm dlx @makoojs/create-makoo
```

然后安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```
