# Mount Components

This page shows how to place a Vue or React component at a specific location on the host page. It starts from a project that has already [added Makoo](./installation.md).

## Declare a Component

Register an adapter in the entry, then declare the component with `inject()`:

::: code-group
```ts [Vue]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Badge from './Badge.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({ name: 'badge', injectAt: '#header', adapter: 'vue', component: Badge })
]);
```
```ts [React]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Badge from './Badge';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'badge', injectAt: '#header', adapter: 'react', component: Badge })
]);
```
:::

- `name`: the injection name, used later to control and inspect this component.
- `injectAt`: the CSS selector of the mount target.
- `adapter`: the adapter name, matching a registered adapter.

## Choose Where to Mount

1. Open the developer tools on the target page and find the element where you want the component.
2. Run `document.querySelector('your selector')` in the console and confirm that it returns this element.
3. Put the selector in `injectAt`.

Core uses the first matching element and appends a `div` to its **end** as the component container. To make the component appear at the start of an element or next to it, choose its parent element as the mount target and adjust the position with CSS.

Components that are not tied to a specific position, such as floating panels, can mount to `body` and use `position: fixed` in their styles.

## Pass Props

`props` are passed as the root component's props:

```ts
inject({
  name: 'badge',
  injectAt: '#header',
  adapter: 'vue',
  component: Badge,
  props: { label: 'Makoo' }
})
```

Vue components receive them with `defineProps<{ label: string }>()`, and React components read them from the function parameter.

To update a Vue component from outside, keep `props` a plain object and put the changing data in one of its `reactive()` properties. Vue shallow-copies a `reactive()` object passed as the root props, so later changes don't take effect when you pass it directly.

```ts
import { reactive } from 'vue';

const state = reactive({ label: 'Loading' });
core.apply([
  inject({ name: 'badge', injectAt: '#header', adapter: 'vue', component: Badge, props: { state } })
]);

state.label = 'Ready';
```

In the component, declare `defineProps<{ state: { label: string } }>()` and read `state.label`.

## Wait for Slow-Loading Elements

Core waits for the mount target to appear, for at most 15 seconds by default. When the host page loads slowly, increase `timeout` (in milliseconds):

```ts
inject({ name: 'badge', injectAt: '#comments', adapter: 'vue', component: Badge, timeout: 60000 })
```

After a timeout, the component status becomes `failed` and the error code of `lastError` is `MAKOO_TARGET_WAIT_TIMEOUT`. When the target only appears after a user action, instead of setting a very long timeout, call `core.command('badge').start()` at the right moment; see [Control Injections and Read Status](./control.md).

## When the Host Replaces Nodes

When a single-page app switches views or partially refreshes a list, it may remove the mount target and create a new one. By default the component ends along with it; to make it remount on the new element, enable `reinject`; see [Handle Node Replacement](./reinject.md).

## Use Vue and React Together

Register both adapters and let each component choose:

```ts
core.useAdapter(createVueAdapter());
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'toolbar', injectAt: '#header', adapter: 'vue', component: Toolbar }),
  inject({ name: 'sidebar', injectAt: '#aside', adapter: 'react', component: Sidebar })
]);
```

## Release the Component's Own Resources

Makoo mounts and unmounts components. Timers, events on `document`, requests, and nodes inserted into `body` that the component creates itself must be released in Vue's `onUnmounted` or a React effect's cleanup function:

```ts
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(refresh, 5000);
});
onUnmounted(() => clearInterval(timer));
```

When you need to listen to elements of the host page, prefer [attached listeners](./listeners.md#listen-along-with-a-component), which Makoo binds and unbinds for you.

## Reference

- [All fields of `inject()`](../api/declarations.md#inject)
- [Vue API](../api/vue.md) / [React API](../api/react.md)
