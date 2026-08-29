# 介绍

Makoo 是一个 userscript 开发框架，用于为 Tampermonkey、Violentmonkey、ScriptCat
等浏览器脚本管理器构建可维护的 Vue 和 React 注入应用。

它适合已经接近小型前端应用的 userscript：需要挂载组件、编排多个功能任务，或者在不同页面上按规则启用不同注入点。Makoo 负责这些任务的运行、挂载和清理。

## 为什么需要 Makoo

传统 userscript 很容易开始，但项目变大后很难保持整洁。宿主页面可能延迟渲染、替换大段
DOM、不完整刷新页面，或者直接移除你已经挂载过组件的节点。同时，现代脚本项目又往往希望拥有组件化 UI、类型化配置、本地开发体验、热更新，以及能被脚本管理器顺利安装的构建产物。

Makoo 关注的是组件代码和脚本管理器之间的中间层：

- 等待目标 DOM 节点出现后再挂载
- 使用 `inject()` 和 `listen()` 编排注入任务
- 通过适配器挂载 Vue 和 React 组件
- 观察宿主目标节点的移除，并在同一选择器重新出现后重新注入

构建产物、userscript 元信息、安装行为和脚本管理器集成由 `vite-plugin-monkey`
处理。Makoo 提供组件注入所需的运行时编排和 adapter 集成。

## 什么时候适合使用

当 userscript 开始包含多个组件、任务或生命周期行为时，可以使用 Makoo 统一编排。

典型场景包括：

- 同一个页面上有多个注入点
- 需要把 Vue 或 React 组件挂载到现有网站里
- 不同页面根据 URL 规则启用不同模块
- 宿主目标节点被移除并重新创建后需要重新注入

如果只是一个非常小的脚本，只在页面加载后改一次元素，直接写原生 userscript 可能已经足够。
Makoo 的价值会在生命周期、模块边界和长期维护开始变重要时体现出来。

## 心智模型

一个 Makoo 应用由几个小概念组成：

| 概念 | 作用 |
| --- | --- |
| Task 声明 | 定义有哪些任务、挂载到哪里、什么时候运行 |
| 注入模块 | 一个独立的注入功能或挂载单元 |
| Makoo runtime | 声明任务、等待目标、挂载模块，并管理重新注入 |
| Adapter | 把 Makoo 的运行时连接到 Vue 或 React 的挂载方式 |
| Vite 插件 | 把 Makoo 配置接入 Vite 与 `vite-plugin-monkey` |

`monkey.userscript.match` 决定脚本管理器在哪些页面加载 userscript；应用代码通过
`createMakoo()`、`inject()` 和 `listen()` 编排要启动的任务，Makoo runtime 等待目标 DOM 并完成挂载。相关代码可以按项目习惯组织。

## Makoo 提供什么

- 使用 `inject()` 和 `listen()` 显式编排运行时
- 用于组件挂载的运行时调度器
- 宿主目标节点移除监听和 alive 重新注入
- Vue 和 React 适配器
- 面向开发和构建流程的 Vite 插件集成

## 阅读路线

如果你是第一次使用 Makoo，推荐按这个顺序阅读：

1. [快速开始](./getting-started.md)：创建项目并定义第一个注入任务。
2. [核心概念](./concepts.md)：理解 runtime、task、模块和 adapter。
3. [配置](./configuration.md)：了解 Makoo、Vite 和 `vite-plugin-monkey` 如何协作。
4. [HMR](./hmr.md)：了解开发更新与清理。
5. [使用示例](./recipes.md)：直接套用常见模式。

## 快速开始预览

```bash
pnpm dlx @makoojs/create-makoo
```

然后安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```
