# Core Runtime Lifecycle

Use this file before changing lifecycle, cancellation, recovery, or status-transition code in `packages/core` (`component/`, `listener/`, `dom/`).

## Reentry points

Outside code runs synchronously inside a runtime call only at these points:

- **State subscribers**, notified by `state.set` (Status and Listener Status subscribers). They can call any Command.
- **Adapter `mount` and `unmount`.**
- **Attached listener start**, which notifies child status subscribers.

Everything else enters on a fresh call stack: MutationObserver delivery (a microtask), timers, DOM event dispatch, and promise settlement of async handlers. Plain DOM calls such as `querySelector`, `append`, `isConnected`, and `removeEventListener` run no code that can reach Makoo controls.

Between two reentry points, runtime state does not change.

## Placing guards

- Re-check cancellation or target validity immediately after a reentry point, and only there. A check with no reentry point since the previous check is redundant.
- Component executions re-check `signal.aborted` at three points: after the `waiting` notification, after `mount`, and after each attached listener starts.
- Stale callbacks are filtered by their owner. `component.ts` and `listener.ts` compare the execution slot with the calling execution; the execution itself only stops its own work.
- Cancellation is the execution's `AbortSignal`. Derive "cancelled" and "cleanup started" from `signal.aborted`.
- Listener executions keep `phase` because a parent stop marks children `cancelled` before aborting each one across `await`s. A MutationObserver delivery can land in that window.
- Commit the slot before notifying subscribers, so a reentrant Command sees the settled result.
- After a terminal slot (`cleanup-failed`, `removed`), every entry checks the slot first. Writing other fields at that point has no effect.
- `waitForElement` reports only connected matches. Code it calls already has a connected target.

## Proving a guard

For each guard, write a test that drives its reentry point through public behavior. Typical scenarios:

- a status subscriber that calls `stop()` or `remove()` on a specific state;
- an adapter `mount` that removes its mount target or moves the container;
- a child status subscriber that stops the parent;
- a DOM change in the same turn as a stop.

Then confirm the guard is load-bearing: remove it temporarily, or run `pnpm test:mutation --mutate <file>`, and check that a test fails. If removing either of two guards survives but removing both fails, they encode one fact: keep the one right after the reentry point and test that one. If no public scenario reaches a guard, it has no trigger; delete it.
