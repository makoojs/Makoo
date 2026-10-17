# The console is the only error output; there is no logger and no `onError`

Makoo does not ship a logger, a logging library, or an `onError` callback. `console.error` is the only error output. It prints the error object itself. `code`, `cause`, and `errors` are read by expanding that object in DevTools. Core does not format the error into a string first.

This was chosen because the old `Logger` mostly printed Task lifecycle lines, and the new Core has no such lines. Lifecycle tracking is Instance Observation (`observe`), not a log. A configurable logger or an error callback would be a second channel that nothing in the product consumes yet.

## Considered Options

- Restore the old `Logger` and fill it with the new error types. Rejected: that logger existed to narrate Task lifecycle, which this Core does not emit.
- Add an `onError` hook so hosts can take over reporting. Rejected for now. If a real caller needs it later, add the callback then. Do not add it in advance.

## Consequences

- Ordinary execution failures, listener callback errors, and cleanup failures are all printed. Printing does not change the execution result.
- A cleanup failure is printed and is also the rejection of `stop` / `remove`. Printing it twice is acceptable.
- `lastError` still has only three sources: an execution failure, a cleanup failure, and a listener callback error. Subscriber failures are printed and are not written to `lastError`.
- The CLI dev terminal is not this channel. It reads status and `lastError` and renders them itself.
