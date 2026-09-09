# 组件注入

本页以已经[接入 Makoo](./installation.md)的项目为起点，把组件挂载到目标网页的 `body` 中。请先确保脚本的 `@match` 覆盖测试页面。

## 创建组件

::: code-group
```vue [src/Panel.vue]
<script setup lang="ts">
import type { VueMountProps } from '@makoojs/vue';
const props = defineProps<VueMountProps>();
</script>

<template>
  <aside class="panel">
    <p>任务：{{ props.makoo.taskId }}</p>
    <button @click="props.makoo.destroy()">关闭面板</button>
  </aside>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 99999;
  padding: 16px;
  background: white;
  color: black;
}
</style>
```
```tsx [src/Panel.tsx]
import type { ReactMountProps } from '@makoojs/react';

export default function Panel({ makoo }: ReactMountProps) {
  return (
    <aside style={{
      position: 'fixed',
      right: 16,
      bottom: 16,
      zIndex: 99999,
      padding: 16,
      background: 'white',
      color: 'black'
    }}>
      <p>任务：{makoo.taskId}</p>
      <button onClick={() => makoo.destroy()}>关闭面板</button>
    </aside>
  );
}
```
:::

Adapter 会传入 `makoo` prop。这里调用 `destroy()` 会销毁当前任务并卸载面板。

## 在入口中启动

按所用框架选择入口：

::: code-group
```ts [Vue: src/main.ts]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
  inject({ id: 'panel', injectAt: 'body', artifact: Panel })
]);
```
```ts [React: src/main.ts]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel.tsx';

createMakoo({ adapters: [createReactAdapter()] }).start([
  inject({ id: 'panel', injectAt: 'body', artifact: Panel })
]);
```
:::

启动 dev、安装开发脚本并访问匹配网页后，页面右下角会显示面板。修改代码后的更新行为见[热更新](./hmr.md)。

## 选择挂载位置

`injectAt` 是 CSS 选择器。把 `body` 换成 `#toolbar`，Makoo 就会等待该目标，并在目标内创建自己的挂载点。

`id` 标识同一个 Runtime 内的任务。任务页和任务句柄都通过这个 ID 定位任务。

## 等待与节点替换

默认等待超时为 5000 毫秒。宿主节点出现较慢时，可以在 `options.timeout` 中调整；节点会被替换时再考虑 `options.alive`，见[生命周期与清理](./lifecycle.md)。

组件自行创建的定时器、页面事件和其他资源，应在 Vue 的 `onUnmounted` 或 React effect 的清理函数中释放。Makoo 负责卸载组件，组件负责自身资源。

## 参考

- [`inject()` 与选项](../api/runtime.md#inject)
- [MakooContext](../api/adapters.md#makoocontext)
- [Vue Adapter](../api/vue.md) / [React Adapter](../api/react.md)
