# Core Instance

The APIs on this page are imported from `@makoojs/core`.

## `createMakoo()`

Creates a Core instance. Each instance has its own adapter registry, injection namespace, and DOM observation; same-named injections in different instances are unrelated.

```ts
function createMakoo(): MakooRuntime;
```

Takes no arguments. Adapters are registered through [`useAdapter()`](#useadapter), and components and listeners are handed to the instance through [`apply()`](#apply).

## `MakooRuntime`

```ts
interface MakooRuntime {
  useAdapter(adapter: MountAdapter): void;
  apply(declarations: readonly MakooInjectionDeclaration[]): void;
  command(name: string): InjectionCommand;
  statusHandle(name: string): InjectionStatusHandle;
  observe(handler: ObservationHandler): () => void;
  dispose(): Promise<void>;
}
```

### `useAdapter()`

Registers a component adapter. Component declarations select it by name through the `adapter` field.

```ts
core.useAdapter(createVueAdapter());   // named 'vue'
core.useAdapter(createReactAdapter()); // named 'react'
```

| Situation | Error code |
| --- | --- |
| The object is missing `name`, `mount`, or `unmount` | `MAKOO_ADAPTER_INVALID` |
| An adapter with the same name is already registered | `MAKOO_ADAPTER_NAME_CONFLICT` |
| The instance has been disposed | `MAKOO_INSTANCE_DISPOSED` |

Registered adapters can't be replaced or unregistered.

### `apply()`

Accepts a batch of declarations, and after validation registers them and starts them immediately.

```ts
core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'vue', component: Panel }),
  listen({ name: 'escape', listenAt: 'body', type: 'keydown', callback: onKeydown })
]);
```

Order of execution:

1. Validate the whole batch: fields, CSS selector syntax, name conflicts within the batch and with the instance, and whether the adapters selected by components are registered.
2. If any item fails, an error is thrown synchronously, and nothing in the batch is registered or started.
3. If all pass, each item is registered, at which point `command()` and `statusHandle()` can find them; they are then started in array order.

| Situation | Error code |
| --- | --- |
| The argument is not a non-empty array, or a declaration is invalid | `MAKOO_DECLARATION_INVALID` |
| A name duplicates another item in the batch or an existing injection in the instance | `MAKOO_INJECTION_NAME_CONFLICT` |
| The adapter selected by a component is not registered | `MAKOO_ADAPTER_NOT_FOUND` |
| The instance has been disposed | `MAKOO_INSTANCE_DISPOSED` |

`apply()` has no return value. After registration, get control handles by name; you can call `apply()` multiple times to add declarations. Problems after starting, such as wait timeouts and mount failures, are not thrown from `apply()` but written to the corresponding injection's `lastError`; see [Error Categories and Handling](../docs/errors.md).

### `command()`

Gets an injection's [command handle](./status.md#command-handle) by name, for starting, stopping, and removing it.

```ts
const panel = core.command('panel');
await panel.stop();
panel.start();
```

Throws `MAKOO_INJECTION_NOT_FOUND` if the name doesn't exist. The handle is bound to the particular injection it was obtained for: after that injection is removed, the old handle doesn't act on a same-named injection registered later.

### `statusHandle()`

Gets an injection's [status handle](./status.md#status-handle) by name, for reading and subscribing to status and reading `lastError`.

```ts
const status = core.statusHandle('panel');
console.log(status.getSnapshot()); // 'waiting' | 'mounted' | ...
```

Throws `MAKOO_INJECTION_NOT_FOUND` if the name doesn't exist. The return value is the status handle of a component or a standalone listener, distinguishable with `'attachedListenerNames' in status`. Like `command()`, it is bound to the particular injection it was obtained for.

### `observe()`

Subscribes to instance-level [observation notices](./status.md#instance-observation) and returns an unsubscribe function.

```ts
const stopObserving = core.observe((notice) => {
  if (notice.type === 'diagnostic') console.warn(notice.name, notice.error);
});
```

- Notices are emitted synchronously after the corresponding fact takes effect.
- When a callback throws, `MAKOO_INSTANCE_OBSERVER_FAILED` is printed, and other callbacks are notified as usual.
- Calling it after the instance has been disposed throws `MAKOO_INSTANCE_DISPOSED`; all subscriptions are cleared once disposal completes.
- This method isn't available inside components. To follow a single injection's status changes, subscribe to its status handle.

### `dispose()`

Destroys the whole instance: stops and removes all injections, after which the instance no longer accepts new adapters, declarations, or subscriptions.

```ts
await core.dispose();
```

- The instance is closed immediately on call, then each injection is removed in registration order; if one fails to clean up, the rest are still cleaned up.
- After everything finishes, an `instance-disposed` notice is emitted.
- If any cleanup fails, the returned Promise rejects with a `MakooAggregateError` (`MAKOO_INSTANCE_CLEANUP_FAILED`), whose `errors` contains each injection's cleanup summary.
- Repeated calls return the same Promise and don't retry failed cleanups.
- Injections removed successfully are unregistered, and looking them up by name afterwards throws `MAKOO_INJECTION_NOT_FOUND`. Injections whose cleanup failed stay registered, so you can still get their handles to read `lastError`; calling `start()` on them throws `MAKOO_INSTANCE_DISPOSED`.

You usually don't need to call `dispose()`: when the page reloads or navigates away, the old page ends together with the instance. For when you do need it, see [Hot Updates](../docs/hmr.md#custom-hot-update-boundaries).
