# Commands and Status

Every top-level injection (component, Each Injection, or standalone listener) has two handles: the command handle starts, stops, and removes it, and the status handle reads and subscribes to its status. Outside components, a component or Each Injection is looked up with [`core.injection(name)`](./instance.md#injection) and a standalone listener with [`core.listener(name)`](./instance.md#listener); each returns an object whose `command` and `statusHandle` are these two handles; inside components, the same handles are available through the [Vue](./vue.md) or [React](./react.md) APIs.

Each Child Injection in an Each Injection's `children` also has its own command handle and status handle, shaped like a component's. Attached listeners have no command handle of their own; their status can only be read through the owning component's status handle.

## Command Handle

```ts
interface ComponentCommand {
  readonly name: string;
  start(): void;
  stop(): Promise<void>;
  remove(): Promise<void>;
}

interface ListenerCommand {
  readonly name: string;
  start(): void;
  stop(): Promise<void>;
  remove(): Promise<void>;
}

type InjectionCommand = ComponentCommand | ListenerCommand;
```

### `start()`

Requests that this injection run.

- Calling it again while already running does not run it twice.
- While the previous round is being cleaned up, the start request is recorded and begins after cleanup succeeds; if cleanup fails, the request is discarded.
- When a new round of execution actually begins, the previous `lastError` is cleared. Full reinjection and local recovery don't clear it.
- When the previous round failed but cleanup succeeded, you can call `start()` again.

| Situation | Error code |
| --- | --- |
| The injection has been removed | `MAKOO_INJECTION_REMOVED` |
| The injection's cleanup failed earlier and it has been closed | `MAKOO_INJECTION_CLOSED` |
| The owning Core instance has been disposed | `MAKOO_INSTANCE_DISPOSED` |

### `stop()`

Stops the current execution and cleans up resources, keeping the registration. You can call `start()` again afterwards.

- The stop intent takes effect immediately: pending searches and recovery work are cancelled, and stale callbacks no longer mount or bind.
- A component stops its attached listeners, unmounts the framework component, and removes the component container, in that order.
- After cleanup finishes, the Promise resolves and the status becomes `idle`. Calling it on a `failed` injection whose execution failed (and whose cleanup succeeded) also changes it to `idle`, keeping `lastError`.
- If cleanup fails, the Promise rejects with a `MakooAggregateError` (`MAKOO_INJECTION_CLEANUP_FAILED`), the status becomes `failed`, and the injection is closed.
- Repeated calls wait for the same cleanup.

### `remove()`

Stops and unregisters this injection. On success, the name is released and a same-named injection can be `apply()`d again with a new declaration.

- After removal, this command handle and status handle belong to the old injection forever: `start()` throws `MAKOO_INJECTION_REMOVED`, and the status stays `idle`.
- After unregistering, the Core instance emits an `injection-removed` notice.
- If cleanup fails, the Promise rejects and the name stays occupied until the page reloads.

### Each Injections and Child Injections

An Each Injection uses the same `ComponentCommand`, applied to the whole group:

- `start()` mounts every current match and keeps collecting new ones; the status becomes `collecting`. It throws the same errors as above.
- `stop()` stops collecting, then stops the live Children one by one; the Promise resolves when all of them are cleaned up, and `children` becomes empty. If any Child fails to clean up, the Promise rejects with one `MakooAggregateError` (`MAKOO_INJECTION_CLEANUP_FAILED`) for the group, and the Each Injection is closed.
- `remove()` does the same, then unregisters the Each Injection.
- After a stop, the next `start()` mounts again on every match, including elements whose Child was stopped or failed in the previous run.

A Child Injection's command handle acts on that Child only:

- `stop()` and `remove()` both unmount it and take it out of `children`; its element isn't mounted again in this run of the Each Injection. Neither of them unregisters anything.
- `start()` does nothing while the Child is in `children`, and throws `MAKOO_INJECTION_REMOVED` once the Child has left; the Each Injection mounts new Children by itself.
- If the Child fails to clean up, its own `stop()` / `remove()` reject with `MAKOO_INJECTION_CLEANUP_FAILED`; the Each Injection keeps running.

## Status Handle

```ts
interface ComponentStatusHandle extends StateView<ComponentStatus> {
  readonly lastError: MakooError | undefined;
  readonly attachedListenerNames: readonly string[];
  attachedListener(name: string): StateView<ListenerStatus>;
}

interface ComponentEachStatusHandle extends StateView<ComponentEachStatus> {
  readonly lastError: MakooError | undefined;
}

interface ListenerStatusHandle extends StateView<ListenerStatus> {
  readonly lastError: MakooError | undefined;
}

type InjectionStatusHandle =
  | ComponentStatusHandle
  | ComponentEachStatusHandle
  | ListenerStatusHandle;
```

A Child Injection's status handle is a `ComponentStatusHandle` whose `attachedListenerNames` is empty.

| Member | Description |
| --- | --- |
| `getSnapshot()` | Read the current status string |
| `subscribe(notify)` | Call `notify()` when the status changes; returns an unsubscribe function |
| `lastError` | The most recent diagnostic error; reading it doesn't create a subscription |
| `attachedListenerNames` | Names of the attached listeners in the component declaration, in declaration order |
| `attachedListener(name)` | Get the status view of an attached listener; throws `MAKOO_LISTENER_NOT_FOUND` if the name doesn't exist |

```ts
const status = core.injection('toolbar').statusHandle;
const unsubscribe = status.subscribe(() => {
  console.log('toolbar:', status.getSnapshot(), status.lastError);
});
```

The status handle stays the same for the lifetime of the injection; full reinjection and local recovery don't replace it.

### `lastError`

`lastError` records the most recent of these three sources:

- Execution failures, such as wait timeouts, mount failures, and target invalidation with recovery not allowed.
- Cleanup failures, whose value is a `MakooAggregateError`.
- Errors from a standalone listener's event handler (`MAKOO_LISTENER_CALLBACK_FAILED`).

An Each Injection's `lastError` only records failures of the group itself: a collection failure such as an invalid `injectAt` selector (`MAKOO_MOUNT_FAILED`), or a cleanup failure. A Child's failure is recorded on that Child's status handle.

A change to `lastError` by itself doesn't notify subscribers. Execution failures and cleanup failures are written before the status changes to `failed`, so they can be read in the subscription callback; callback errors are only written and don't change the status.

The two kinds of `failed` can't be told apart by the status string alone: when `lastError.code` is `MAKOO_INJECTION_CLEANUP_FAILED`, the injection has been closed; other error codes indicate an execution failure, and you can call `start()` again.

Errors thrown by status subscribers are only printed to the console and are not written to `lastError`. For error categories, see [Error Categories and Handling](../docs/errors.md).

## Status Values

### `ComponentStatus`

```ts
type ComponentStatus = 'idle' | 'waiting' | 'mounted' | 'failed';
```

| Status | Meaning |
| --- | --- |
| `idle` | Not running: not started yet, stopped, or removed |
| `waiting` | Finding the mount target or mounting; also the status during full reinjection |
| `mounted` | The adapter has mounted the component, and attached listeners have started finding their targets |
| `failed` | Execution failure or cleanup failure; see `lastError` for the cause |

`mounted` doesn't mean all attached listeners are bound. On the initial mount, attached listeners may still be `waiting`; read their status separately.

A Child Injection uses `ComponentStatus` too: it is `waiting` while mounting, `mounted` afterwards, `idle` after it is stopped or removed, and `failed` when mounting fails or its element leaves the page (`MAKOO_MOUNT_TARGET_DETACHED`).

### `ComponentEachStatus`

```ts
type ComponentEachStatus = 'idle' | 'collecting' | 'failed';
```

| Status | Meaning |
| --- | --- |
| `idle` | Not running: not started yet, stopped, or removed |
| `collecting` | Running: Children are mounted on current matches and new matches are mounted as they appear; stays here even when nothing matches |
| `failed` | Collection failure or cleanup failure of the group; see `lastError` |

Children stopping or failing doesn't change the Each Injection's status. Read each Child's status from `children`.

### `ListenerStatus`

```ts
type ListenerStatus = 'idle' | 'waiting' | 'bound' | 'failed';
```

| Status | Meaning |
| --- | --- |
| `idle` | Not running: not started yet, stopped, or removed |
| `waiting` | Finding the listener target; also the status during local recovery |
| `bound` | The event is bound to the listener target |
| `failed` | Wait timeout, bind failure, target invalidation with recovery not allowed, or cleanup failure |

Host events firing don't change the listener status. Handle business events such as clicks and playback in the event handler.

## `StateView`

A status view provides snapshot reading and subscription:

```ts
interface StateView<T> {
  getSnapshot(): Readonly<T>;
  subscribe(notify: () => void): () => void;
}
```

- While the status doesn't change, `getSnapshot()` returns the same value; after a change, the snapshot is replaced and subscribers are notified synchronously.
- `notify` receives no arguments; call `getSnapshot()` in the callback to read the new value.
- When a subscriber throws, Core prints `MAKOO_STATE_SUBSCRIBER_FAILED` and emits a `diagnostic` notice, and other subscribers are notified as usual.

This shape can be passed directly to React's `useSyncExternalStore`. In components mounted by Makoo, prefer the wrappers provided by [Vue](./vue.md) or [React](./react.md), which release subscriptions automatically.

## Instance Observation

The callback of [`core.observe()`](./instance.md#observe) receives observation notices:

```ts
type ObservationNotice =
  | { type: 'injection-removed'; name: string }
  | { type: 'instance-disposed' }
  | { type: 'diagnostic'; name?: string; error: MakooError };

type ObservationHandler = (notice: ObservationNotice) => void;
```

| Notice | When it is emitted |
| --- | --- |
| `injection-removed` | A top-level injection was removed successfully and unregistered |
| `instance-disposed` | `dispose()` has processed all injections; emitted only once per instance |
| `diagnostic` | A diagnostic that doesn't change status occurred: a status subscriber error (with `name`) or an observation callback error (without `name`) |

Status changes of individual injections don't appear in instance observation; subscribe to their status handles.
