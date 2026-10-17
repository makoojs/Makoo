# 教程：可开关的工具面板

在本教程中，你会在 `https://example.com/` 上做一个小面板：

- 面板显示它对网页标题的监听状态；
- 点击网页标题，标题背景高亮；
- 点击面板上的按钮关闭面板，标题监听随之停止；
- 按 Escape 键重新打开面板。

整个过程只涉及两个文件，大约需要 15 分钟。

## 开始之前

完成[快速开始](./getting-started.md)：你已经有一个 `makoo-project` 项目，`@match` 为 `https://example.com/*`，开发脚本已安装，`pnpm dev` 正在运行。

下面的代码分为 Vue 和 React 两个版本，选择你在创建项目时用的那个。

## 1. 编写面板组件

新建 `src/injections/panel/Panel.vue`（React 项目为 `Panel.tsx`）：

::: code-group
```vue [Panel.vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const title = makoo.attachedListener('title-click');
</script>

<template>
  <aside class="panel">
    <p>标题监听：{{ title }}</p>
    <button @click="makoo.stop()">关闭面板</button>
  </aside>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 99999;
  padding: 12px 16px;
  background: white;
  color: black;
  border: 1px solid #ccc;
  border-radius: 8px;
}
</style>
```
```tsx [Panel.tsx]
import { useAttachedListenerStatus, useComponentCommand } from '@makoojs/react';

export default function Panel() {
  const { stop } = useComponentCommand();
  const title = useAttachedListenerStatus('title-click');

  return (
    <aside
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 99999,
        padding: '12px 16px',
        background: 'white',
        color: 'black',
        border: '1px solid #ccc',
        borderRadius: 8
      }}
    >
      <p>标题监听：{title}</p>
      <button onClick={() => stop()}>关闭面板</button>
    </aside>
  );
}
```
:::

组件从 Makoo 取得两样东西：

- 名为 `title-click` 的监听的**状态**，显示在面板上。下一步会声明这个监听。
- 所属组件的**命令入口**，按钮调用它的 `stop()` 关闭面板。

## 2. 声明面板和标题监听

把 `src/main.ts` 的内容替换为：

::: code-group
```ts [Vue]
import { createMakoo, inject, listen } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './injections/panel/Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({
    name: 'panel',
    injectAt: 'body',
    adapter: 'vue',
    component: Panel,
    listeners: [
      listen({
        name: 'title-click',
        listenAt: 'h1',
        type: 'click',
        callback() {
          const title = this as HTMLElement;
          title.style.background = title.style.background ? '' : 'yellow';
        }
      })
    ]
  })
]);
```
```ts [React]
import { createMakoo, inject, listen } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './injections/panel/Panel.tsx';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({
    name: 'panel',
    injectAt: 'body',
    adapter: 'react',
    component: Panel,
    listeners: [
      listen({
        name: 'title-click',
        listenAt: 'h1',
        type: 'click',
        callback() {
          const title = this as HTMLElement;
          title.style.background = title.style.background ? '' : 'yellow';
        }
      })
    ]
  })
]);
```
:::

和快速开始相比，多了 `listeners`：它声明了一个**附属监听**，在网页的 `h1` 上监听点击。附属监听属于面板，面板挂载后它才开始工作，面板停止时它也一起停止。回调中的 `this` 就是被监听的 `h1`。

保存后，网页会自动刷新。

## 3. 在网页上试一试

回到 `https://example.com/`：

1. 右下角出现面板，显示 `标题监听：bound`，表示事件已经绑定在标题上。
2. 点击网页标题 Example Domain，背景变黄；再点一次，恢复原样。

## 4. 关闭面板

点击面板上的「关闭面板」。

面板消失了。再点击网页标题，背景不再变化：附属监听随面板一起停止并解绑了。

面板此时处于 `idle` 状态：它的声明还在，只是没有运行。面板已经卸载，无法自己重新打开，需要由面板之外的代码调用 `start()`。

## 5. 用 Escape 键重新打开

在 `src/main.ts` 的 `apply([...])` 数组中，在 `inject({...})` 末尾的 `})` 后面加一个逗号，再加入一个新的监听：

```ts
  }),
  listen({
    name: 'toggle-panel',
    listenAt: 'body',
    type: 'keydown',
    callback(event) {
      if ((event as KeyboardEvent).key !== 'Escape') return;
      const panel = core.command('panel');
      if (core.statusHandle('panel').getSnapshot() === 'idle') panel.start();
      else panel.stop();
    }
  })
```

这是一个**独立监听**：它直接放在 `apply()` 里，不属于任何组件，所以面板关闭后它仍在工作。它通过名称 `panel` 取得面板的状态入口和命令入口：面板空闲时启动，否则停止。

保存，等网页刷新后：

1. 按 Escape，面板消失。
2. 再按 Escape，面板重新出现，显示 `标题监听：bound`，点击标题又能高亮了。

## 你完成了什么

你做出了一个可开关的面板，并用到了 Makoo 的几个核心部分：

- 用 `inject()` 声明组件、由 `apply()` 挂载到网页上，用附属监听让组件和它依赖的网页元素一起启停。
- 在组件内读取监听状态、调用命令入口。
- 用独立监听和 `core.command()` / `core.statusHandle()` 从组件外控制面板。

## 下一步

- [核心概念](./concepts.md)：独立监听与附属监听、命令入口与状态入口为什么这样划分。
- [应对节点替换](./reinject.md)：网站重新渲染、替换了标题时，让监听自动重新绑定。
- [控制注入与读取状态](./control.md)：等待停止完成、在组件外订阅状态等更多用法。
