# Callback errors are only reported and do not end the Injection

core calls two kinds of code that it does not own: listener event handlers, and Status Handle subscribers (Vue/React adapters or user code). When they throw a synchronous exception or return a rejected Promise, core only reports that exception and does not treat it as an execution failure: event bindings stay active, the owning component is not unmounted, the status stays unchanged, and the remaining subscribers are notified as usual. The run status expresses which step the framework's execution has reached; callback errors are a different kind of information, and the two are expressed separately.

Reporting only was chosen because such errors usually affect only this one handling or this one subscriber; escalating them to an execution failure would unmount the whole component or unbind all events, turning a local problem into the entire feature being unavailable.

## Consequences

- The error system needs to distinguish callback errors from framework execution failures; the former must not trigger ending, cleanup, or reinjection.
