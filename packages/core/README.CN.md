# @makoojs/core

<p>
  <a href="https://www.npmjs.com/package/@makoojs/core"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/core?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/zh/api/core">API 参考</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/core/README.md">English</a>
</p>

Makoo 的核心包，运行在浏览器中。你用它创建 Core 实例，声明组件和网页事件监听，再控制它们、读取它们的状态。等待目标元素、挂载、节点被替换后恢复和清理都在这里完成。

它不依赖任何前端框架，组件通过 [`@makoojs/vue`](https://www.npmjs.com/package/@makoojs/vue) 或 [`@makoojs/react`](https://www.npmjs.com/package/@makoojs/react) 提供的适配器挂载。

## 安装

```sh
pnpm add @makoojs/core
```

> [!TIP]
> 用 `pnpm dlx @makoojs/create-makoo` 创建的项目已经装好了它，不需要单独安装。

## 用法

### 声明组件与监听

```ts
import { createMakoo, inject, listen } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());

core.apply([
  inject({
    name: 'panel',
    injectAt: '#sidebar',
    adapter: 'vue',
    component: Panel,
    // 网站替换掉 #sidebar 后重新挂载
    reinject: true,
    listeners: [
      // 附属监听：随 panel 一起启动和停止
      listen({
        name: 'search',
        listenAt: '#search-form',
        type: 'submit',
        callback: () => console.log('提交了搜索')
      })
    ]
  }),
  // 独立监听：不属于任何组件
  listen({
    name: 'escape',
    listenAt: 'body',
    type: 'keydown',
    callback: (event) => {
      if ((event as KeyboardEvent).key === 'Escape') console.log('按下了 Escape');
    }
  })
]);
```

### 在每个匹配元素上挂载

`injectEach()` 把同一个组件挂载到每个匹配 `injectAt` 的元素上，之后出现的元素也会挂载；一个都没匹配到时会持续监视：

```ts
import { injectEach } from '@makoojs/core';

core.apply([
  injectEach({ name: 'badges', injectAt: '.comment .author', adapter: 'vue', component: Badge })
]);
```

### 控制注入与读取状态

每个注入都可以按名称取得命令入口和状态入口：组件和 Each 注入用 `core.injection(name)`，独立监听用 `core.listener(name)`。Each 注入还会在 `children` 中列出每个元素上的子注入。

```ts
const panel = core.injection('panel');
const escape = core.listener('escape');
const status = panel.statusHandle;

status.subscribe(() => {
  console.log(status.getSnapshot(), status.lastError);
});

await panel.command.stop();
panel.command.start();
await escape.command.stop();
```

## 文档

- [Core 实例](https://makoojs.github.io/Makoo/zh/api/instance)：`createMakoo()` 与实例上的方法。
- [声明](https://makoojs.github.io/Makoo/zh/api/declarations)：`inject()`、`injectEach()` 与 `listen()` 的全部字段。
- [命令与状态](https://makoojs.github.io/Makoo/zh/api/status)：启动、停止、移除，以及状态值的含义。
- [错误与错误码](https://makoojs.github.io/Makoo/zh/api/errors)：错误的种类和处理方式。
