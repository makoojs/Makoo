# Makoo 文档

Makoo 用于在现有网页中运行 Vue、React 组件和事件监听任务。它等待目标元素出现、挂载组件，并管理任务清理；Vite 与 `vite-plugin-monkey` 提供开发服务和 userscript 构建。

## 从这里开始

第一次使用，请从[快速开始](./getting-started.md)创建项目、安装开发脚本，并在匹配页面看到组件。已有 Vite 项目可以直接阅读[手动接入](./installation.md)。

你需要了解 JavaScript、CSS 选择器，以及所选框架的组件写法。开发前请准备一个浏览器脚本管理器，例如 Tampermonkey 或 ScriptCat。

## 按目标阅读

| 你想做什么 | 阅读 |
| --- | --- |
| 创建并运行第一个脚本 | [快速开始](./getting-started.md) |
| 理解 Runtime、任务和 Adapter | [核心概念](./concepts.md) |
| 在目标元素上挂载组件 | [组件注入](./injection.md) |
| 监听页面事件并控制开关 | [事件监听](./listeners.md) |
| 处理节点替换、重置与销毁 | [生命周期与清理](./lifecycle.md) |
| 查看开发任务、日志和快捷键 | [本地开发](./development.md) |
| 生成可安装的 userscript | [构建与预览](./build.md) |
| 排查脚本未运行或组件未出现 | [常见问题](./troubleshooting.md) |
| 查询参数、返回值和类型 | [API 参考](../api/core.md) |

## 什么时候适合使用

当一个 userscript 有多个注入点、组件或事件监听，需要等待异步 DOM、处理宿主节点替换并释放资源时，Makoo 可以统一管理这些任务。只需在页面加载时改一次元素的小脚本，原生 DOM API 通常已经足够。

## 包的分工

| 包 | 用在什么地方 |
| --- | --- |
| `@makoojs/core` | 浏览器入口：创建 Runtime、声明和管理任务 |
| `@makoojs/vue` / `@makoojs/react` | 浏览器入口：注册所选框架的 Adapter |
| `@makoojs/cli` | Vite 配置和 `dev`、`build`、`preview` 命令 |
| `@makoojs/cli/monkey` | 浏览器代码：调用脚本管理器的 GM API |
| `@makoojs/create-makoo` | 创建项目 |
