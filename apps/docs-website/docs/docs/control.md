# Control Injections and Read Status

This page shows how to start, stop, and remove an injection, and how to read its status inside and outside components. Every top-level injection has a command handle (`start` / `stop` / `remove`) and a status handle (status and `lastError`); for the concepts, see [Core Concepts](./concepts.md#command-and-status-handles).

## Control from Outside a Component

Get the handles from the Core instance by injection name:

```ts
const panel = core.injection('panel');

await panel.command.stop();               // unmount the component, keep the registration
panel.command.start();                    // find the mount target again and mount
console.log(panel.statusHandle.getSnapshot());
```

Handles can be obtained in any module that can access `core`; they don't need to be passed from where `apply()` is called. If the name doesn't exist, `MAKOO_INJECTION_NOT_FOUND` is thrown.

### Example: Toggle a Panel from the Script Manager Menu

```ts
import { gmMenu } from '@makoojs/cli/monkey';

gmMenu.register('Show / hide panel', () => {
  const panel = core.injection('panel');
  const status = panel.statusHandle.getSnapshot();
  if (status === 'idle') panel.command.start();
  else void panel.command.stop();
});
```

## Control Itself from Inside a Component

A component can get the command handle of its owning injection, for example to make a close button:

::: code-group
```vue [Vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
</script>

<template>
  <button @click="makoo.stop()">Close</button>
</template>
```
```tsx [React]
import { useComponentCommand } from '@makoojs/react';

export default function Panel() {
  const { stop } = useComponentCommand();
  return <button onClick={() => stop()}>Close</button>;
}
```
:::

Once a component stops itself it is unmounted and can't start itself again. To reopen it, code outside the component (such as the menu above) calls `start()`.

The difference between `stop()` and `remove()`:

| Operation | Afterwards |
| --- | --- |
| `stop()` | Registration kept; can `start()` again |
| `remove()` | Unregistered, name released; the old handles are permanently invalid |

## Show Status Inside a Component

::: code-group
```vue [Vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const status = makoo.status;
const button = makoo.attachedListener('site-button');
</script>

<template>
  <p>Component: {{ status }}, site button: {{ button }}</p>
</template>
```
```tsx [React]
import { useAttachedListenerStatus, useComponentStatus } from '@makoojs/react';

export default function Panel() {
  const status = useComponentStatus();
  const button = useAttachedListenerStatus('site-button');
  return <p>Component: {status}, site button: {button}</p>;
}
```
:::

Vue returns read-only refs, which are unwrapped automatically in the template once assigned to top-level variables in `<script setup>`; React hooks return status strings. Subscriptions are released automatically when the component unmounts.

When a React component only needs part of the information, passing a selector reduces renders:

```ts
const ready = useAttachedListenerStatus('site-button', (status) => status === 'bound');
```

## Subscribe to Status Outside a Component

```ts
const status = core.injection('panel').statusHandle;
const unsubscribe = status.subscribe(() => {
  if (status.getSnapshot() === 'failed') console.warn('panel failed:', status.lastError);
});
```

The `subscribe()` callback receives no arguments; call `getSnapshot()` inside the callback. When you no longer need it, call the returned `unsubscribe()`.

A component's status handle can also read the status of its attached listeners:

```ts
for (const name of status.attachedListenerNames) {
  console.log(name, status.attachedListener(name).getSnapshot());
}
```

## Wait for a Stop to Finish

`stop()` and `remove()` return Promises that resolve after cleanup finishes. When you need to confirm resources have been released before continuing, `await` them:

```ts
try {
  await core.injection('panel').command.remove();
} catch (error) {
  // Cleanup failed: error is a MakooAggregateError and the injection has been closed
  console.error(error);
}
```

When you only send a stop request and don't care about the result, `void core.injection('panel').command.stop()` is enough; cleanup failures are still printed to the console.

## Switch to a Different Configuration

A declaration is fixed at `apply()` time. To change configuration such as the selector, timeout, or props object, remove it first and declare it again:

```ts
await core.injection('panel').command.remove();
core.apply([
  inject({ name: 'panel', injectAt: '#new-place', adapter: 'vue', component: Panel })
]);
```

Old handles obtained before removal still point to the old injection; call `core.injection('panel')` again to get the new handle.

## Destroy the Whole Instance

`core.dispose()` removes all injections in the instance, and afterwards the instance no longer accepts new declarations:

```ts
await core.dispose();
```

When the page reloads or navigates away, the browser cleans up along with the instance, so you usually don't need to call it manually. It is only needed for custom hot update boundaries; see [Hot Updates](./hmr.md#custom-hot-update-boundaries).

## Reference

- [Commands and Status API](../api/status.md)
- [Vue `useMakooComponent()`](../api/vue.md#usemakoocomponent) / [React hooks](../api/react.md#hooks)
