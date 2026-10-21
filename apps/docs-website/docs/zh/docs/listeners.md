# 监听页面事件

本页说明如何监听宿主网页元素上的事件，例如网站自己的搜索框、按钮或视频。Makoo 负责等待元素出现、绑定事件，并在停止时解绑。组件内部元素的事件请直接用框架的写法，不需要 Makoo。

先判断用哪一种监听（区别见[核心概念](./concepts.md#独立监听与附属监听)）：

- 监听本身就是一个功能，与组件无关：**独立监听**。
- 监听是某个组件功能的一部分：**附属监听**。

## 独立监听

把 `listen()` 声明直接放进 `apply()`。独立监听不需要适配器：

```ts
import { createMakoo, listen } from '@makoojs/core';

const core = createMakoo();
core.apply([
  listen({
    name: 'page-click',
    listenAt: 'body',
    type: 'click',
    callback: (event) => console.log('Clicked:', event.target)
  })
]);
```

- `listenAt`：监听目标的 CSS 选择器，使用第一个匹配的元素。
- `type`：事件类型。
- `callback`：事件处理函数，接收原生事件对象。

需要在捕获阶段处理事件（例如抢在网站自己的处理函数之前）时，设置 `capture: true`。

## 读取监听目标

用普通函数写回调时，`this` 就是监听目标；箭头函数中请使用 `event.currentTarget`：

```ts
listen({
  name: 'video-play',
  listenAt: 'video',
  type: 'play',
  callback(this: Element) {
    console.log('开始播放', (this as HTMLVideoElement).currentSrc);
  }
})
```

## 暂停与恢复

用命令入口停止和重新启动独立监听，声明保持不变：

```ts
const clicks = core.listener('page-click').command;
await clicks.stop(); // 解绑事件，状态 idle
clicks.start();      // 重新查找目标并绑定
```

下面的例子用 Escape 键开关上面的点击监听：

```ts
listen({
  name: 'toggle-clicks',
  listenAt: 'body',
  type: 'keydown',
  callback: (event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') return;
    const status = core.listener('page-click').statusHandle.getSnapshot();
    if (status === 'idle') core.listener('page-click').command.start();
    else void core.listener('page-click').command.stop();
  }
})
```

不再需要时调用 `remove()`，它会解绑并注销，名称可以再次使用。

## 随组件一起监听

把 `listen()` 声明放进组件的 `listeners`，它就成为附属监听：组件挂载后开始查找目标，组件停止时一起解绑。

下面的面板显示网站搜索框里正在输入的内容。事件处理函数通过一个共享的 Vue `ref` 把数据交给组件：

::: code-group
```ts [src/query.ts]
import { ref } from 'vue';

export const query = ref('');
```
```ts [src/main.ts]
import { createMakoo, inject, listen } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import SearchPreview from './SearchPreview.vue';
import { query } from './query';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({
    name: 'search-preview',
    injectAt: 'body',
    adapter: 'vue',
    component: SearchPreview,
    listeners: [
      listen({
        name: 'search-input',
        listenAt: 'input[name="q"]',
        type: 'input',
        callback(this: Element) {
          query.value = (this as HTMLInputElement).value;
        }
      })
    ]
  })
]);
```
```vue [src/SearchPreview.vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';
import { query } from './query';

const search = useMakooComponent().attachedListener('search-input');
</script>

<template>
  <aside style="position: fixed; right: 16px; bottom: 16px">
    <p v-if="search !== 'bound'">正在等待搜索框…</p>
    <p v-else>正在搜索：{{ query }}</p>
  </aside>
</template>
```
:::

React 组件使用 `useAttachedListenerStatus('search-input')` 读取同样的状态，见 [React API](../api/react.md#useattachedlistenerstatus)。

附属监听的几条规则：

- 名称只需在所属组件内唯一。
- 不能单独启动或停止，只能读取状态；要停止它，就停止整个组件。
- 不能设置 `reinject`，它沿用组件的设置。
- 它失败时（等待超时、目标失效且不允许恢复），整个组件以 `MAKOO_ATTACHED_LISTENER_FAILED` 结束。

## 在组件中控制独立监听

组件可以按名称取得同一实例中的独立监听，读取状态并调用它的命令。组件卸载时只释放订阅，不会停止这个监听。

::: code-group
```vue [Vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const clicks = useMakooComponent().listener('page-click');
const status = clicks.status;
</script>

<template>
  <button @click="status === 'idle' ? clicks.start() : clicks.stop()">
    点击日志：{{ status }}
  </button>
</template>
```
```tsx [React]
import { useListener } from '@makoojs/react';

export default function ClickToggle() {
  const clicks = useListener('page-click');

  return (
    <button onClick={() => (clicks.status === 'idle' ? clicks.start() : clicks.stop())}>
      点击日志：{clicks.status}
    </button>
  );
}
```
:::

名称不存在或不是独立监听时，抛出 `MAKOO_INJECTION_NOT_FOUND`。

## 目标会被替换时

网站重新渲染时可能把监听目标换成一个新元素。默认情况下监听随之失败；独立监听设置 `reinject: true`、附属监听让所属组件设置 `reinject: true`，即可自动重新绑定，见[应对节点替换](./reinject.md)。

## 回调出错时

事件处理函数抛错或返回被拒绝的 Promise 时，Makoo 打印 `MAKOO_LISTENER_CALLBACK_FAILED`，监听保持绑定，下一次事件照常调用。独立监听还会把错误写入 `lastError`，但状态不变，订阅者和组件界面不会收到通知。

## 参考

- [`listen()` 的全部字段](../api/declarations.md#listen)
- [命令与状态](../api/status.md)
