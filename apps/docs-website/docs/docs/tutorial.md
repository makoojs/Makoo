# Tutorial: A Toggleable Tool Panel

In this tutorial, you will build a small panel on `https://example.com/`:

- The panel shows the status of its listener on the page title.
- Clicking the page title highlights its background.
- Clicking the button on the panel closes the panel, and the title listener stops with it.
- Pressing Escape reopens the panel.

The whole process involves only two files and takes about 15 minutes.

## Before You Begin

Complete the [Quick Start](./getting-started.md): you already have a `makoo-project` project, `@match` is `https://example.com/*`, the development script is installed, and `pnpm dev` is running.

The code below comes in Vue and React versions. Pick the one you chose when creating the project.

## 1. Write the Panel Component

Create `src/injections/panel/Panel.vue` (`Panel.tsx` for React projects):

::: code-group
```vue [Panel.vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const title = makoo.attachedListener('title-click');
</script>

<template>
  <aside class="panel">
    <p>Title listener: {{ title }}</p>
    <button @click="makoo.stop()">Close panel</button>
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
      <p>Title listener: {title}</p>
      <button onClick={() => stop()}>Close panel</button>
    </aside>
  );
}
```
:::

The component gets two things from Makoo:

- The **status** of the listener named `title-click`, shown on the panel. The next step declares this listener.
- The owning component's **command handle**. The button calls its `stop()` to close the panel.

## 2. Declare the Panel and the Title Listener

Replace the contents of `src/main.ts` with:

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

Compared with the Quick Start, there is a new `listeners` field: it declares an **attached listener** that listens for clicks on the page's `h1`. The attached listener belongs to the panel. It starts working only after the panel mounts, and it stops when the panel stops. `this` in the callback is the `h1` being listened to.

After you save, the page reloads automatically.

## 3. Try It on the Page

Go back to `https://example.com/`:

1. A panel appears in the bottom-right corner showing `Title listener: bound`, which means the event is bound to the title.
2. Click the page title Example Domain. Its background turns yellow; click again and it returns to normal.

## 4. Close the Panel

Click "Close panel" on the panel.

The panel disappears. Clicking the page title no longer changes its background: the attached listener stopped and unbound along with the panel.

The panel is now `idle`: its declaration still exists, it just isn't running. The panel has been unmounted and cannot reopen itself, so code outside the panel has to call `start()`.

## 5. Reopen with Escape

In the `apply([...])` array in `src/main.ts`, add a comma after the `})` that closes `inject({...})`, then add a new listener:

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

This is a **standalone listener**: it sits directly in `apply()` and belongs to no component, so it keeps working after the panel closes. It gets the panel's status handle and command handle by the name `panel`: it starts the panel when the panel is idle, and stops it otherwise.

Save, and after the page reloads:

1. Press Escape. The panel disappears.
2. Press Escape again. The panel reappears showing `Title listener: bound`, and clicking the title highlights it again.

## What You Accomplished

You built a toggleable panel and used several core parts of Makoo:

- Declared a component with `inject()`, mounted it on the page through `apply()`, and used an attached listener so the component and the page element it depends on start and stop together.
- Read listener status and called the command handle inside the component.
- Controlled the panel from outside the component with a standalone listener and `core.command()` / `core.statusHandle()`.

## Next Steps

- [Core Concepts](./concepts.md): why standalone and attached listeners, and command and status handles, are split this way.
- [Handle Node Replacement](./reinject.md): rebind listeners automatically when the site re-renders and replaces the title.
- [Control Injections and Read Status](./control.md): more usage such as waiting for a stop to finish and subscribing to status outside a component.
