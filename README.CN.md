<p align="center">
  <img width="180" src="./apps/docs-website/docs/public/makoo-icon.svg" alt="Makoo">
</p>

<h1 align="center">Makoo</h1>


<p align="center"><em>用 Vue 或 React 构建 userscript 的开发框架</em></p>

<p align="center">
  <a href="https://github.com/makoojs/Makoo/"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/makoojs/Makoo?style=flat-square"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20.19%2B%20%7C%2022.12%2B-3c873a?style=flat-square">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://makoojs.github.io/Makoo/zh/">文档</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#什么时候适合使用">适用场景</a> •
  <a href="./README.md">English</a>
</p>

---

Makoo 是面向 Tampermonkey、Violentmonkey 与 ScriptCat 的 userscript 开发框架。你用 Vue 或 React 编写组件，声明它们挂载到网页的哪个位置、要监听网页上的哪些事件；等待元素出现、挂载组件、节点被替换后恢复、功能停止时清理，都由 Makoo 负责。开发服务、userscript 元信息与构建由 [Vite](https://vite.dev/) 和 [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 提供。

## 特性

- **组件化开发**：用 Vue 或 React 编写注入到网页中的界面。
- **声明式注入**：声明挂载位置与附属监听，组件和它依赖的网页事件一起启停。
- **应对动态页面**：等待异步加载的节点，网站替换节点后自动重新挂载。
- **完整清理**：停止或移除时卸载组件、解绑事件，清理失败会明确报告。
- **完整工具链**：脚手架、热更新、终端内查看注入状态，一条命令构建出 `.user.js`。

## 什么时候适合使用

> [!IMPORTANT]
> Makoo 不是为简单脚本准备的。如果你的脚本只是改一个按钮、隐藏一个元素，或者注入一段样式，直接写原生 userscript 往往就够了。

当脚本开始像一个小型前端应用时，Makoo 才真正派上用场：

- 需要用 Vue 或 React 构建界面，对现有网页进行改造
- 同一个页面上有多个组件或功能模块
- 目标节点会被网站移除、重新创建，组件和监听需要跟着恢复
- 代码量在增长，需要清晰的结构、配置和开发流程

## 快速开始

准备好 pnpm，并在浏览器中安装一个脚本管理器，然后创建项目：

```sh
pnpm dlx @makoojs/create-makoo
cd makoo-project
pnpm dev
```

在浏览器中打开终端打印的地址，安装开发脚本，再访问你设置的目标网页，就能看到示例组件。

已有 Vite 项目，请看[接入已有项目](https://makoojs.github.io/Makoo/zh/docs/installation)。

## 用法

### 声明组件

在入口文件中创建 Core 实例，注册框架适配器，再声明要挂载的组件：

```ts
// src/main.ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());

core.apply([
  inject({
    // 注入名称，在同一个实例中唯一
    name: 'panel',
    // 挂载目标的 CSS 选择器，元素晚些出现也会等待
    injectAt: 'body',
    adapter: 'vue',
    component: Panel
  })
]);
```

### 在组件中控制注入

组件可以读取自己的状态，也可以停止自己：

```vue
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const status = makoo.status;
</script>

<template>
  <aside>
    <p>状态：{{ status }}</p>
    <button @click="makoo.stop()">关闭</button>
  </aside>
</template>
```

React 写法、页面事件监听和节点替换后的恢复，见[文档](https://makoojs.github.io/Makoo/zh/)。

## 文档

从[快速开始](https://makoojs.github.io/Makoo/zh/docs/getting-started)和[教程：可开关的工具面板](https://makoojs.github.io/Makoo/zh/docs/tutorial)入手，完整的指南与 API 参考见[文档站](https://makoojs.github.io/Makoo/zh/)。

## 致谢

Makoo 构建在 [Vite](https://vite.dev/)、[vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)、[Vue](https://vuejs.org/) 与 [React](https://react.dev/) 之上，感谢这些项目。
