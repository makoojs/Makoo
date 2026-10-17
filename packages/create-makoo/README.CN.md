# @makoojs/create-makoo

<p>
  <a href="https://www.npmjs.com/package/@makoojs/create-makoo"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/create-makoo?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/zh/docs/getting-started">快速开始</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/create-makoo/README.md">English</a>
</p>

Makoo 的项目脚手架。回答几个问题，就能得到一个可以直接运行的 userscript 项目：Vite 配置、开发命令和一个示例组件都已经准备好。

## 用法

```sh
pnpm dlx @makoojs/create-makoo
```

也可以用 `npx @makoojs/create-makoo` 或 `yarn dlx @makoojs/create-makoo`。

脚手架会依次询问项目名、userscript 名称、版本、命名空间和匹配的网址，再让你选择 TypeScript 或 JavaScript、Vue 或 React，最后询问是否立即安装依赖。

创建完成后：

```sh
cd makoo-project
pnpm dev
```

在浏览器中打开终端打印的地址并安装开发脚本，再访问匹配的网页，就能看到示例组件。

> [!NOTE]
> 目标目录已存在且不为空时，脚手架会让你选择取消、删除已有文件后继续，或保留已有文件继续。

## 文档

- [快速开始](https://makoojs.github.io/Makoo/zh/docs/getting-started)：从创建项目到在网页上看到第一个组件。
- [教程：可开关的工具面板](https://makoojs.github.io/Makoo/zh/docs/tutorial)：在生成的项目上继续做一个完整的小功能。
