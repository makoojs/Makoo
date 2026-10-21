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
  injection(name: string): ComponentInjection;
  listener(name: string): ListenerInjection;
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

1. Check the batch: non-empty array, each entry is a component or listener declaration, name conflicts within the batch and with the instance, attached-listener rules, and whether the adapters selected by components are registered.
2. If any item fails, an error is thrown synchronously, and nothing in the batch is registered or started.
3. If all pass, each item is registered, at which point `injection()` / `listener()` can find them; they are then started in array order.

| Situation | Error code |
| --- | --- |
| The argument is not a non-empty array, an entry is not a component or listener, or an attached listener sets `reinject` | `MAKOO_DECLARATION_INVALID` |
| A name duplicates another item in the batch or an existing injection in the instance | `MAKOO_INJECTION_NAME_CONFLICT` |
| The adapter selected by a component is not registered | `MAKOO_ADAPTER_NOT_FOUND` |
| The instance has been disposed | `MAKOO_INSTANCE_DISPOSED` |

`apply()` has no return value. After registration, get control handles by name; you can call `apply()` multiple times to add declarations. Problems after starting, such as wait timeouts and mount failures, are not thrown from `apply()` but written to the corresponding injection's `lastError`; see [Error Categories and Handling](../docs/errors.md).

### `injection()`

Gets a component injection by name. The returned object has `.command` and `.statusHandle`.

```ts
const panel = core.injection('panel');
await panel.command.stop();
panel.command.start();
console.log(panel.statusHandle.getSnapshot()); // 'waiting' | 'mounted' | ...
```

Throws `MAKOO_INJECTION_NOT_FOUND` if the name isn't among this Core Instance's top-level injections. Repeated calls for the same registration return the same object. After that injection is removed, the old object doesn't act on a same-named injection registered later.

### `listener()`

Gets a standalone listener by name. The returned object has `.command` and `.statusHandle`.

```ts
const clicks = core.listener('page-click');
await clicks.command.stop();
console.log(clicks.statusHandle.getSnapshot()); // 'waiting' | 'bound' | ...
```

Throws `MAKOO_INJECTION_NOT_FOUND` if the name isn't among this Core Instance's top-level injections. Like `injection()`, it is bound to the particular registration it was obtained for.

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
