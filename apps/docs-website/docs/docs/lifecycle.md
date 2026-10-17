# Injection Lifecycle

The host page decides when elements appear and when they are replaced; Makoo cannot control that. This page explains how Core schedules a mount in that environment, how it decides when the mount becomes invalid, and how it cleans up and recovers afterwards. For terms, see [Core Concepts](./concepts.md).

## Injections and Executions

An injection begins when `apply()` registers it and ends when `remove()` succeeds. In between, it may go through multiple rounds of **execution**:

- **Component execution**: from finding the mount target until this round's component, container, and attached listeners have all been cleaned up.
- **Listener execution**: one pass of finding the listener target, binding the event, and eventually unbinding.

The injection itself lives for a long time and holds the declaration, name, command handle, and status handle; each execution is responsible only for its own round's DOM and resources. Stopping and full reinjection both mean "end this round and start the next one if needed". The handles never change, so the handles held by components and external code always remain usable.

## One Round of Component Execution

```text
start()
  ↓ status waiting
Find the mount target (wait budget timeout, default 15 seconds)
  ↓ first matching element found
Create a component container at the end of the mount target → adapter mounts the component
  ↓ mount returns
Start all attached listeners (each finds its own target)
  ↓ status mounted
Keep checking that the mount target and component container remain valid
```

Key points:

- If the target already exists, it is found immediately; otherwise Core rechecks whenever the page DOM changes, until it is found or the wait times out.
- Each search has its own budget, and ordinary DOM changes on the page do not reset the countdown. After a timeout, the round fails with `MAKOO_TARGET_WAIT_TIMEOUT` and is not retried automatically.
- Core uses only the first matching element; other matching elements that appear later are not handled.
- `mounted` means the adapter's mount call has returned, not that the framework has finished its first render; React's first commit usually happens a little later.
- After the mount returns, and after each attached listener starts, Core immediately checks the mount target and component container again without waiting for the next DOM change.
- When the component enters `mounted`, its attached listeners may still be `waiting`. The component can use this to show a hint such as "waiting for the site button to load".

## What Counts as Invalid

After finding the mount target, Core cares about **that element itself**, not the selector:

- The round becomes invalid when the mount target leaves the page (including when one of its ancestors is removed).
- The round becomes invalid when the component container is removed, or moved out of the mount target.
- Changes to the mount target's text, attributes, or classes do not count as invalidation, even if it no longer matches the original selector.
- Elements that are removed and reinserted within the same batch of DOM changes, and end up valid, do not trigger a rebuild.

Listener targets work the same way: when the target leaves the page, that round of listener execution becomes invalid.

## Cleanup Order

When a round of component execution ends, whatever the reason, Core cleans up in the same order:

1. Invalidate the round: stop searching and invalidation detection; late callbacks no longer take effect.
2. Stop all attached listeners and unbind their events.
3. Call the adapter to unmount the component synchronously.
4. Remove the component container.
5. Collect the round's end reason, execution errors, and cleanup errors.

If one step fails, the remaining steps still run, releasing as many created resources as possible. The next round does not start until cleanup finishes, so old and new components never exist at the same time.

## After a Round Ends

| How the round ended | Afterwards | Status |
| --- | --- | --- |
| `stop()` called, cleanup succeeded | Registration kept, waiting for another `start()` | `idle` |
| `remove()` called, cleanup succeeded | Unregistered, name released | `idle` |
| Target invalidated, `reinject` enabled | The next round starts automatically and finds the mount target again | `waiting` |
| Target invalidated, `reinject` not enabled | Stops; `lastError` is `MAKOO_MOUNT_TARGET_DETACHED` | `failed` |
| Execution failure (timeout, mount failure, etc.), cleanup succeeded | Stops, no automatic retry, can be started manually with `start()` | `failed` |
| Any reason, but cleanup failed | The injection is closed and refuses to start again | `failed` |

Calling `stop()` while in the `failed` state caused by an execution failure changes the status to `idle`; `lastError` is kept until the next `start()`.

An adapter mount error is not always a restartable execution failure: when the adapter reports a mount failure and also cannot release everything cleanly (for example, a Vue child component throws in `setup`), it is handled as a cleanup failure and the injection is closed.

### Full Reinjection and Local Recovery

`reinject` controls two kinds of recovery with different scopes:

- **Full reinjection**: when the mount target or component container becomes invalid, the whole round ends (the component is unmounted and its internal state is lost), then everything starts again from finding the mount target.
- **Local recovery**: when the target of one attached listener becomes invalid, only that listener is found and bound again. The component and other listeners stay as they are, and that listener's status is `waiting` during recovery.

Any execution failure of an attached listener ends the whole component with `MAKOO_ATTACHED_LISTENER_FAILED`: an initial wait timeout, a bind failure, a local recovery timeout, and target invalidation when `reinject` is not enabled. This ending does not trigger full reinjection, even if the component has `reinject` enabled. Attached listeners are part of the component's feature, and without them the component should not keep pretending to be usable.

Standalone listeners use their own `reinject` to decide whether to recover, and a failure affects only themselves.

## Control Intent

`start()` and `stop()` express **intent**, and Core only carries out the latest intent:

- Rapidly toggling start and stop does not accumulate multiple starts.
- Calling `start()` while cleanup is in progress starts the next round only if this round ended because of `stop()` or "target invalidated with `reinject` enabled", and cleanup succeeded. If the round ended with an execution failure, the start request is discarded and the status stays `failed`.
- Calling `stop()` while the adapter is mounting ends the round as soon as the mount returns, without starting attached listeners.
- `remove()` cancels start requests that have not run yet.

## Why Cleanup Failure Closes the Injection

A cleanup failure means Core cannot confirm that no component, container, or event binding is left on the page. If a restart were allowed at this point, the new round could pile up on leftover resources, causing duplicate mounts and events firing twice. Such problems are harder to notice and locate than "the feature stopped".

So an injection whose cleanup failed stays `failed`: it keeps its diagnostics, keeps occupying its name, and refuses `start()` (`MAKOO_INJECTION_CLOSED`; `MAKOO_INSTANCE_DISPOSED` once the instance has been `dispose()`d). Repeated `stop()`, `remove()`, or `dispose()` calls return the same failure result and do not try to clean up again. After fixing the problem, reload the page. Other injections are not affected.

Ordinary execution failures are not in this category: as long as cleanup succeeds, the injection can be started again.

## Who Cleans Up What

| Resource | Responsible party |
| --- | --- |
| Target search, invalidation detection, component container | Core |
| Event bindings of attached and standalone listeners | Core |
| Mounting and unmounting the component | Adapter |
| Status subscriptions inside the component (created through Makoo APIs) | Adapter, released when the component unmounts |
| The component's own timers, global events, requests, and nodes inserted into `body` | Component, released in the framework's unmount hooks |

Core does not interrupt an event handler that has already started running, and does not roll back its business side effects; unbinding only guarantees it will not be called again.
