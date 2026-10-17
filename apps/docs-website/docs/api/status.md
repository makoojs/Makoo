# Commands and Status

Every top-level injection (component or standalone listener) has two handles: the command handle starts, stops, and removes it, and the status handle reads and subscribes to its status. Outside code gets them through [`core.command()`](./instance.md#command) and [`core.statusHandle()`](./instance.md#statushandle); inside components, the same handles are available through the [Vue](./vue.md) or [React](./react.md) APIs.

Attached listeners have no command handle of their own; their status can only be read through the owning component's status handle.

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

## Status Handle

```ts
interface ComponentStatusHandle extends StateView<ComponentStatus> {
  readonly lastError: MakooError | undefined;
  readonly attachedListenerNames: readonly string[];
  attachedListener(name: string): StateView<ListenerStatus>;
}

interface ListenerStatusHandle extends StateView<ListenerStatus> {
  readonly lastError: MakooError | undefined;
}

type InjectionStatusHandle = ComponentStatusHandle | ListenerStatusHandle;
```

| Member | Description |
| --- | --- |
| `getSnapshot()` | Read the current status string |
| `subscribe(notify)` | Call `notify()` when the status changes; returns an unsubscribe function |
| `lastError` | The most recent diagnostic error; reading it doesn't create a subscription |
| `attachedListenerNames` | Names of the attached listeners in the component declaration, in declaration order |
| `attachedListener(name)` | Get the status view of an attached listener; throws `MAKOO_LISTENER_NOT_FOUND` if the name doesn't exist |

```ts
const status = core.statusHandle('toolbar');
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
