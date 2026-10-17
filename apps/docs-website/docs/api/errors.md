# Errors

Makoo uses only two error classes: `MakooError` and `MakooAggregateError`, which extends it. Every error has an error code `code`, used to tell error kinds apart in code. For when errors occur and how to handle them, see [Error Categories and Handling](../docs/errors.md).

## `MakooError`

```ts
class MakooError extends Error {
  readonly code: string;
  constructor(message: string, options: { code: string; cause?: unknown });
}
```

| Field | Description |
| --- | --- |
| `name` | `'MakooError'` |
| `message` | Says what Makoo was doing and to what, for example `Failed to mount "panel"` |
| `code` | Error code; see below |
| `cause` | The wrapped underlying error, such as a value thrown by an adapter or event handler; for declaration and adapter validation failures, it is the Zod validation error. Problems Makoo detects itself, such as timeouts and target invalidation, have no `cause` |

The `message` of validation errors has multiple lines: the first is a summary, and each following line is `field path: problem`.

Expand the error object in the browser console and follow `cause` to find the original code location.

```ts
import { MakooError, MakooErrorCode } from '@makoojs/core';

try {
  core.command('panel').start();
} catch (error) {
  if (error instanceof MakooError && error.code === MakooErrorCode.INJECTION_CLOSED) {
    console.warn('panel was closed after a cleanup failure; please reload the page');
  }
}
```

## `MakooAggregateError`

Collects multiple child errors; used for cleanup failures.

```ts
class MakooAggregateError extends MakooError {
  readonly errors: readonly unknown[];
  constructor(errors: readonly unknown[], message: string, options: { code: string; cause?: unknown });
}
```

- The first line of `message` is the summary, followed by one line per direct child error.
- In `INJECTION_CLEANUP_FAILED`, if this wind-down was caused by an execution failure, that execution error comes first in `errors`, followed by the errors of each cleanup step; cleanup errors of attached listeners are merged in here too.
- The `errors` of `INSTANCE_CLEANUP_FAILED` are the `INJECTION_CLEANUP_FAILED` of each injection, at most two levels deep.

## `MakooErrorCode`

All error codes are strings with the `MAKOO_` prefix. Compare using the constants, for example `MakooErrorCode.TARGET_WAIT_TIMEOUT`.

### Configuration Errors

Thrown synchronously by `useAdapter()` or `apply()`; none of the declarations in the same batch start.

| Constant | Meaning |
| --- | --- |
| `DECLARATION_INVALID` | Invalid declaration field, selector syntax error, or `apply()` received an empty array |
| `INJECTION_NAME_CONFLICT` | Duplicate injection name, or duplicate attached listener names within the same component |
| `ADAPTER_INVALID` | The adapter is missing `name`, `mount`, or `unmount` |
| `ADAPTER_NAME_CONFLICT` | An adapter with the same name is already registered |
| `ADAPTER_NOT_FOUND` | The adapter selected by a component is not registered |

### Control Errors

The current status or context doesn't allow this call; thrown synchronously.

| Constant | Meaning |
| --- | --- |
| `INJECTION_NOT_FOUND` | The name doesn't exist; or what `globalListener()` looked up is not a standalone listener |
| `LISTENER_NOT_FOUND` | The component has no attached listener with this name |
| `INJECTION_REMOVED` | The injection has been removed and can't be started again |
| `INJECTION_CLOSED` | The injection's cleanup failed earlier and it can't be started again |
| `INSTANCE_DISPOSED` | The Core instance has been disposed |

### Execution Failures

Ends one execution, is written to `lastError`, and the status becomes `failed`. After cleanup succeeds, you can `start()` again.

| Constant | Meaning |
| --- | --- |
| `TARGET_WAIT_TIMEOUT` | The mount target or listener target was not found within `timeout` |
| `MOUNT_TARGET_DETACHED` | The mount target or component container became invalid, and `reinject` is not enabled |
| `MOUNT_FAILED` | The adapter threw while mounting; the original error is in `cause` |
| `LISTENER_TARGET_DETACHED` | The listener target left the page, and recovery is not allowed |
| `LISTENER_BIND_FAILED` | Binding the event threw |
| `ATTACHED_LISTENER_FAILED` | An attached listener failure ended the owning component; the child error is in `cause` |

### Cleanup Failures

Core can't confirm that all resources were released, and the injection is closed (later `start()` calls throw `INJECTION_CLOSED`).

| Constant | Meaning |
| --- | --- |
| `UNMOUNT_FAILED` | The adapter threw while unmounting |
| `CONTAINER_REMOVE_FAILED` | Removing the component container failed |
| `LISTENER_UNBIND_FAILED` | Unbinding the event failed |
| `MOUNT_CLEANUP_FAILED` | For the adapter contract: thrown when the adapter also fails to release resources after a mount failure. Core unpacks it, so what you see in `lastError` is `INJECTION_CLEANUP_FAILED`, containing `MOUNT_FAILED` followed by each release error |
| `INJECTION_CLEANUP_FAILED` | Summary of one wind-down of one injection, a `MakooAggregateError` |
| `INSTANCE_CLEANUP_FAILED` | Summary of `dispose()`, a `MakooAggregateError` |

### Callback Errors

User code called by Makoo threw; only reported, without changing status.

| Constant | Meaning |
| --- | --- |
| `LISTENER_CALLBACK_FAILED` | An event handler threw or returned a rejected Promise |
| `STATE_SUBSCRIBER_FAILED` | A status subscriber threw |
| `INSTANCE_OBSERVER_FAILED` | An `observe()` callback threw |

### Adapter Error Codes

| Constant | Package | Meaning |
| --- | --- | --- |
| `VueErrorCode.VUE_HOOK_OUTSIDE_COMPONENT` | `@makoojs/vue` | Makoo's injection context isn't available when calling `useMakooComponent()`: not in a Vue app mounted by Makoo, or not called synchronously in `setup` (for example, in an event handler or `setTimeout`) |
| `VueErrorCode.VUE_HOOK_OUTSIDE_SCOPE` | `@makoojs/vue` | The injection context is available but there is no effect scope, for example when called in a plugin through `app.runWithContext()` |
| `VueErrorCode.VUE_PARTIAL_MOUNT_UNCONFIRMED` | `@makoojs/vue` | Vue mounting failed midway and cleanup can't be confirmed; the injection is closed as a result |
| `ReactErrorCode.REACT_HOOK_OUTSIDE_COMPONENT` | `@makoojs/react` | Makoo hooks were called outside a React component mounted by Makoo |
