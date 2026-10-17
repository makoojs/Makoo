# Makoo 文档

Makoo 是用于开发用户脚本的框架。你可以用 Vue 或 React 编写组件，再声明它们挂载到网页的哪个位置、需要监听网页上的哪些事件。Makoo 负责等待元素出现、挂载组件、绑定事件，并在网页替换节点或功能停止时完整清理。开发服务与 userscript 构建由 Vite 和 `vite-plugin-monkey` 提供。

支持 Tampermonkey、Violentmonkey 和 ScriptCat。你需要了解 JavaScript、CSS 选择器，以及所选框架的组件写法。

## 从这里开始

第一次使用，请按顺序完成两篇教程：

1. [快速开始](./getting-started.md)：创建项目、安装开发脚本，在网页上看到第一个组件。
2. [教程：可开关的工具面板](./tutorial.md)：做一个能监听网页元素、能关闭和重新打开的面板。

已有 Vite 项目，请看[接入已有项目](./installation.md)。

## 按需阅读

| 你想要 | 阅读 |
| --- | --- |
| 完成某个具体任务 | 操作指南：[挂载组件](./injection.md)、[监听页面事件](./listeners.md)、[控制注入与读取状态](./control.md)、[应对节点替换](./reinject.md) |
| 配置、调试与发布 | [项目配置](./configuration.md)、[本地开发](./development.md)、[构建与预览](./build.md)、[常见问题](./troubleshooting.md) |
| 理解它为什么这样工作 | [核心概念](./concepts.md)、[注入的生命周期](./lifecycle.md)、[错误的分类与处置](./errors.md)、[热更新](./hmr.md) |
| 查询参数、返回值和类型 | [API 参考](../api/core.md) |

## 什么时候适合使用

当一个用户脚本要在多个位置放组件、监听网站元素的事件，并且要应对异步加载的 DOM、单页应用的节点替换和资源释放时，Makoo 能把这些事统一管理起来。

如果只是在页面加载时改一次某个元素，直接使用原生 DOM API 通常就够了。

## 包的分工

| 包 | 运行在 | 用途 |
| --- | --- | --- |
| `@makoojs/core` | 浏览器 | 创建 Core 实例，声明组件与监听，控制和读取状态 |
| `@makoojs/vue` / `@makoojs/react` | 浏览器 | 框架适配器，以及组件内使用的 API |
| `@makoojs/cli` | Node | `makoo()`、`makooDev()` Vite 插件与 `dev` / `build` / `preview` 命令 |
| `@makoojs/cli/monkey` | 浏览器 | 调用脚本管理器的 GM API |
| `@makoojs/create-makoo` | Node | 创建新项目 |
