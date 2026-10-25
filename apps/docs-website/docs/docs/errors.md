# Error Categories and Handling

Makoo does not categorize errors by "what went wrong", but by **where they appear and who handles them**. Once you know which category an error belongs to, you know where to look for it and whether it affects the feature.

For the full list of error codes, see the [Errors API](../api/errors.md).

## Five Categories

| Category | When it appears | Where you see it | Effect on the feature |
| --- | --- | --- | --- |
| Configuration error | During `useAdapter()` and `apply()` | Thrown synchronously | None of the batch starts |
| Control error | When calling a command or query handle | Thrown synchronously | This call has no effect |
| Execution failure | While running | `lastError`, console | This round ends, status `failed` |
| Cleanup failure | During cleanup | `lastError`, console, rejection of `stop()` / `remove()` | The injection is closed |
| Callback error | When your callback throws | Console, partly written to `lastError` | None |

### Configuration Errors: Reported Before Anything Starts

Duplicate names, an attached listener that sets `reinject`, an adapter selected by a component that is not registered, an empty array passed to `apply()`, or an entry that is not a component, Each Injection, or listener declaration are all thrown synchronously during `apply()`, and **none** of the declarations in the batch start. Registering an adapter whose name is already taken throws synchronously from `useAdapter()`. For the full list, see [configuration error codes](../api/errors.md#configuration-errors).

This avoids a batch of features getting halfway started before the other half turns out to be misconfigured, leaving a partial state that is hard to explain. Configuration errors usually appear the first time you open the page during development; just fix the code.

### Control Errors: This Call Is Not Allowed

Calling `core.injection()` or `core.listener()` with a name that doesn't exist, starting an injection that has been removed, and calling `useMakooComponent()` outside a component mounted by Makoo are all control errors. They are thrown synchronously and indicate that the caller's assumptions don't match the current state.

### Execution Failures: This Round Ends, and You Can Try Again

Execution failures happen after starting, for example when the target never appears, the adapter's mount throws, or the target becomes invalid and recovery is not allowed. Because they happen in the background, after `apply()` has long returned, Core does not throw them. Instead it:

- writes the error to the status handle's `lastError`;
- prints the error object with `console.error`;
- sets the status to `failed` after cleanup succeeds.

Execution failures are not retried automatically, but once cleanup succeeds you can call `start()` again. For example, if the target only appears after a user action, you can start it manually at the right moment. If cleanup itself also fails (for example, the adapter cannot release everything cleanly after a mount failure), it is handled as a cleanup failure, described below.

### Cleanup Failures: If It Can't Be Confirmed Clean, It Doesn't Continue

When unmounting the component, removing the container, or unbinding events fails during cleanup, Core cannot confirm that nothing is left on the page. The injection is then closed: its status is `failed`, `lastError` is a `MakooAggregateError` collecting all the errors, the name stays occupied, and later `start()` calls throw `MAKOO_INJECTION_CLOSED`.

If the cleanup was triggered by `stop()` or `remove()`, the Promise they return is also rejected with the same error object. `dispose()` instead rejects with `MAKOO_INSTANCE_CLEANUP_FAILED`, and each injection's cleanup errors are in that error's `errors`. For the reasoning, see [Why Cleanup Failure Closes the Injection](./lifecycle.md#why-cleanup-failure-closes-the-injection).

### Callback Errors: Reported, Not Escalated

Core calls code it doesn't own: event handlers, status subscribers, and `observe()` callbacks. When this code throws synchronously, Core only reports it and does not treat it as an execution failure: event bindings stay, the component is not unmounted, the status doesn't change, and other subscribers are notified as usual.

The reasoning is that such errors usually affect only this one invocation. If a click handler's error unmounted the component and unbound every event, a local problem would make the whole feature unusable.

The reporting differs slightly:

| Source | Console | `lastError` | Instance observation |
| --- | --- | --- | --- |
| Event handler of a standalone listener | Printed | Written | Not notified |
| Event handler of an attached listener | Printed | Not written | Not notified |
| Status subscriber | Printed | Not written | `diagnostic` |
| `observe()` callback | Printed | Not applicable | `diagnostic` (without `name`) |

When an event handler returns a rejected Promise, it is also reported as in the table above. Promises returned by status subscribers and `observe()` callbacks are not awaited, and Makoo does not catch their rejections.

Status subscriber errors are not written to `lastError` because subscribers are often called when the status changes to `failed`; writing to it would overwrite the real cause of failure.

## Reading an Error

Errors that Makoo throws or reports are all `MakooError`, with three key fields:

- `message`: what Makoo was doing and to whom, for example `Failed to mount "panel"`.
- `code`: the kind of error, compared in code using `MakooErrorCode` constants.
- `cause`: the original error Makoo caught, for example an error your component threw in `setup`.

Makoo only adds a wrapping layer when it catches someone else's error; problems it determines itself, such as timeouts and target invalidation, are reported directly without a `cause`. Expand the error in the browser console and follow `cause` down to find the original line of code. Aggregate errors (`MakooAggregateError`) also have `errors`, listing every child error without losing any; cleanup errors given by an adapter are kept as-is and are not necessarily `MakooError`.

Makoo has no logging system of its own, and the console is the only output location. When you need to handle errors in code, read the status handle's `lastError`, or react when the status changes to `failed`; see [Troubleshooting](./troubleshooting.md#reading-errors).
