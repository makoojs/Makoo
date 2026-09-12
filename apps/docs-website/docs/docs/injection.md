# Component Injection

Start with a project that has [Makoo installed](./installation.md). This page mounts a component inside the target page’s `body`. Make sure the script’s `@match` includes your test page.

## Create a component

::: code-group
```vue [src/Panel.vue]
<script setup lang="ts">
import type { VueMountProps } from '@makoojs/vue';
const props = defineProps<VueMountProps>();
</script>

<template>
  <aside class="panel">
    <p>Task: {{ props.makoo.taskId }}</p>
    <button @click="props.makoo.destroy()">Close panel</button>
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
      <p>Task: {makoo.taskId}</p>
      <button onClick={() => makoo.destroy()}>Close panel</button>
    </aside>
  );
}
```
:::

The adapter provides the `makoo` prop. Calling `destroy()` destroys this task and unmounts the panel.

## Start from the entry

Choose the entry for your framework:

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

Start dev, install the development script, and visit a matching page. The panel appears in the bottom-right corner. See [Hot Updates](./hmr.md) for what happens when you edit code.

## Choose a target

`injectAt` is a CSS selector. Replace `body` with `#toolbar` to wait for that target and create a mount point inside it.

`id` identifies a task within one Runtime. Task inspection and task handles use this ID to identify the task.

## Waiting and target replacement

The default wait timeout is 5000 milliseconds. Adjust `options.timeout` if the host target appears later. Consider `options.alive` when the host replaces targets; see [Lifecycle and Cleanup](./lifecycle.md).

Release timers, page listeners, and other component-owned resources in Vue’s `onUnmounted` or a React effect cleanup. Makoo unmounts the component; the component owns its resources.

## Reference

- [`inject()` and options](../api/runtime.md#inject)
- [MakooContext](../api/adapters.md#makoocontext)
- [Vue Adapter](../api/vue.md) / [React Adapter](../api/react.md)
