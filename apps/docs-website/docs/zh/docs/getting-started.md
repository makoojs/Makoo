# 快速开始

创建一个项目，把开发脚本安装到浏览器，并让第一个组件出现在目标网页上。

## 1. 准备环境

- Node.js 20.19+（20.x）或 22.12+，以及 pnpm。
- 在浏览器中安装并启用脚本管理器，例如 Tampermonkey 或 ScriptCat。
- 选择一个可以测试的页面。本例使用 `https://example.com/`。

已有 Vite 项目请看[手动接入](./installation.md)。

## 2. 创建项目

```sh
pnpm dlx @makoojs/create-makoo
```

按提示填写项目名、脚本名称、版本、namespace、匹配 URL、语言和框架。本例项目名填写 `makoo-project`，匹配 URL 填写 `https://example.com/*`，选择 TypeScript 和 Vue 或 React。

进入生成的目录。如果创建时没有安装依赖，先执行 `pnpm install`：

```sh
cd makoo-project
pnpm install
pnpm dev
```

## 3. 安装开发脚本

打开终端打印的本地地址，在脚本管理器弹出的页面中确认安装。然后访问 `https://example.com/`：模板中的 Hello World 组件应该出现在页面上。

安装入口和目标网页是两个地方：前者用来安装脚本，后者才是组件运行的位置。开发期间保持 `pnpm dev` 运行。

如果没有出现组件，先检查当前 URL 是否匹配 `vite.config.ts` 中的 `monkey.userscript.match`，再查看浏览器控制台。详细步骤见[常见问题](./troubleshooting.md)。

## 4. 找到应用入口

模板的主要文件：

```text
vite.config.ts                 # userscript 元信息和构建配置
src/main.ts                    # 创建 Runtime、启动任务
src/injections/hello-world/    # Vue 或 React 组件及样式
assets/                        # 示例资源
```

修改 `src/injections/hello-world/App.vue` 或 `App.tsx` 中的文字，再回到目标网页观察变化。

## 5. 理解第一个任务

Vue 模板的入口使用下面的组合：

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './injections/hello-world/App.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
  inject({ id: 'hello-world', injectAt: 'body', artifact: App })
]);
```

`inject()` 声明任务，`start()` 注册并运行任务。`injectAt: 'body'` 指定宿主元素，`artifact` 是要挂载的组件。React 项目使用 `createReactAdapter()` 和 `App.tsx`；完整示例见[组件注入](./injection.md)。

## 下一步

- [核心概念](./concepts.md)：区分配置、任务声明、Runtime 和组件。
- [本地开发](./development.md)：添加 `makooDev()`，查看任务和终端操作。
- [构建与预览](./build.md)：生成并检查正式 userscript。
