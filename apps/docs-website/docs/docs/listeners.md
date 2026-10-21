# Listen to Page Events

This page shows how to listen to events on elements of the host page, such as the site's own search box, buttons, or videos. Makoo waits for the element to appear, binds the event, and unbinds it when stopped. For events on elements inside your components, use your framework's own syntax directly; you don't need Makoo.

First decide which kind of listener to use (see [Core Concepts](./concepts.md#standalone-and-attached-listeners) for the difference):

- The listener is a feature on its own, unrelated to any component: **standalone listener**.
- The listener is part of a component's feature: **attached listener**.

## Standalone Listeners

Put the `listen()` declaration directly in `apply()`. Standalone listeners don't need an adapter:

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

- `listenAt`: the CSS selector of the listener target; the first matching element is used.
- `type`: the event type.
- `callback`: the event handler, which receives the native event object.

When you need to handle the event in the capture phase (for example, to run before the site's own handler), set `capture: true`.

## Read the Listener Target

When the callback is a regular function, `this` is the listener target; in arrow functions, use `event.currentTarget`:

```ts
listen({
  name: 'video-play',
  listenAt: 'video',
  type: 'play',
  callback(this: Element) {
    console.log('Playback started', (this as HTMLVideoElement).currentSrc);
  }
})
```

## Pause and Resume

Use the command handle to stop and restart a standalone listener; the declaration stays the same:

```ts
const clicks = core.listener('page-click').command;
await clicks.stop(); // unbind the event, status idle
clicks.start();      // find the target again and bind
```

The example below toggles the click listener above with the Escape key:

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

When it's no longer needed, call `remove()`; it unbinds and unregisters the listener, and the name can be used again.

## Listen Along with a Component

Put the `listen()` declaration in the component's `listeners` and it becomes an attached listener: it starts finding its target after the component mounts, and unbinds when the component stops.

The panel below shows what is being typed into the site's search box. The event handler passes data to the component through a shared Vue `ref`:

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
    <p v-if="search !== 'bound'">Waiting for the search box…</p>
    <p v-else>Searching: {{ query }}</p>
  </aside>
</template>
```
:::

React components read the same status with `useAttachedListenerStatus('search-input')`; see the [React API](../api/react.md#useattachedlistenerstatus).

A few rules for attached listeners:

- The name only needs to be unique within its owning component.
- It can't be started or stopped on its own, only its status can be read; to stop it, stop the whole component.
- It can't set `reinject`; it uses the component's setting.
- When it fails (wait timeout, target invalidated with recovery not allowed), the whole component ends with `MAKOO_ATTACHED_LISTENER_FAILED`.

## Control a Standalone Listener from a Component

A component can get a standalone listener in the same instance by name, read its status, and call its commands. When the component unmounts, only the subscription is released; the listener is not stopped.

::: code-group
```vue [Vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const clicks = useMakooComponent().listener('page-click');
const status = clicks.status;
</script>

<template>
  <button @click="status === 'idle' ? clicks.start() : clicks.stop()">
    Click log: {{ status }}
  </button>
</template>
```
```tsx [React]
import { useListener } from '@makoojs/react';

export default function ClickToggle() {
  const clicks = useListener('page-click');

  return (
    <button onClick={() => (clicks.status === 'idle' ? clicks.start() : clicks.stop())}>
      Click log: {clicks.status}
    </button>
  );
}
```
:::

If the name isn't among this Core Instance's top-level injections, `MAKOO_INJECTION_NOT_FOUND` is thrown.

## When the Target Gets Replaced

When the site re-renders, it may replace the listener target with a new element. By default the listener fails along with it; set `reinject: true` on a standalone listener, or on the owning component for an attached listener, to rebind automatically; see [Handle Node Replacement](./reinject.md).

## When the Callback Errors

When an event handler throws or returns a rejected Promise, Makoo prints `MAKOO_LISTENER_CALLBACK_FAILED`, the listener stays bound, and the next event calls it as usual. Standalone listeners also write the error to `lastError`, but the status doesn't change, and subscribers and the component UI are not notified.

## Reference

- [All fields of `listen()`](../api/declarations.md#listen)
- [Commands and Status](../api/status.md)
