# Lifecycle and Cleanup

The host page decides when target DOM appears or is replaced. Makoo manages waiting, mounting, and releasing tasks; components still clean up resources they create.

## Wait for a target

Component tasks wait up to 5000 milliseconds by default. `options.timeout` changes the wait for that task. The `dom:targetTimeout` event identifies a task whose target did not appear in time.

## Reinject after target replacement

Enable `alive` when the host removes a matched target and later creates an element matching the same selector:

`src/main.ts`

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const makoo = createMakoo({ adapters: [createVueAdapter()] });
makoo.start([
  inject({
    id: 'panel',
    injectAt: '#toolbar',
    artifact: Panel,
    options: { alive: true, scope: 'global', timeout: 5000 }
  })
]);
```

This example uses `Panel.vue` from [Component Injection](./injection.md). Omit these options for a stable target; the defaults are `alive: false` and `scope: 'local'`.

This example uses `scope: 'global'` to wait for the replacement target across the document. Makoo mounts the component again when the target returns.

## Reset and destroy

| Operation | Effect |
| --- | --- |
| `reset(taskId)` | Releases current resources and retains the task record |
| `destroy(taskId)` | Releases resources and removes the task |
| `disableAlive(taskId)` | Stops alive observation and keeps the mounted component |
| `enableAlive(taskId)` | Enables alive for a component task, observing removal or waiting for a target depending on its current mount state |

Call `makoo.destroy(taskId)` to remove a feature.

## Clean up a batch

For batch control, save the return value with `const tasks = makoo.start(...)`. `tasks.destroyAll()` cleans up only the tasks returned by that `start()` call. `makoo.destroyAll()` cleans up all tasks in the Runtime. Use these methods to remove a feature while the page continues running. For development updates, see [Hot Updates and Cleanup](./hmr.md).

Makoo releases the mount points, listeners, and observers it manages with the task. Release component-owned timers, subscriptions, and events in framework unmount hooks.

## Observe lifecycle events

Register global hooks in `createMakoo({ hooks: ... })`, or task hooks in `inject()` through `options.hooks`. For example, use `artifact:mountFail` and `dom:targetTimeout` to distinguish mounting failures from target wait timeouts. See [Events and State](../api/observation.md) for signatures and propagation rules.
