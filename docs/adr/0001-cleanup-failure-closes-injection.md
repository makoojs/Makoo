# Close the Injection after a cleanup failure, without automatic recovery

When an execution of an Injection is wrapping up, if any cleanup step fails (the adapter unmount throws, container removal fails, listener unbinding fails, etc.), core cannot confirm that no component, container, or event binding is left on the page. In that case the Injection becomes failed and stays closed: it keeps its record and diagnostics, keeps holding its Injection Name, and rejects subsequent starts; repeated stop, remove, or instance dispose requests reuse the same failure result and do not retry cleanup. The way to recover is to fix the problem and refresh the page.

Closing was chosen over retrying or forcing a reset because leftover resources stacking with a new round of execution cause duplicate mounts and duplicate event triggers, and such problems are harder for userscript authors to notice and locate than "the feature stopped". Other top-level Injections are not affected.

## Considered Options

- Automatically or manually retrying cleanup: unmounting is synchronous and the cause of failure usually does not go away on its own, so a retry will most likely produce the same failure, and it would also unmount the same execution multiple times.
- Forcibly forgetting the record and releasing the name: this allows a same-named Injection to mount again next to the leftover resources, which is exactly the stacking to be avoided.

## Consequences

- Only cleanup failures fall under this policy. Ordinary execution failures (wait timeout, mount failure, target invalidated) can still be started externally on demand once cleanup has succeeded.
- The error system must be able to distinguish "execution failure" from "cleanup failure", and keep both when they occur together; when an explicit stop or remove is rejected because of a cleanup failure, the caller must be able to get these errors.
