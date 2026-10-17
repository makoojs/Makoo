# Injections are switched with `start` and `stop`; `activitySignal` is not restored

An Injection is turned on and off through its command: `start`, `stop`, and `remove`. `core.command(name)` outside a component and `useMakooComponent()` / `useComponentCommand()` inside one are the same functions. There is no `activitySignal` that attaches or detaches work independently of that command.

`activitySignal` belonged to the old Task model. The new model already has a command per top-level Injection, so a second switch would mean two ways to ask for the same thing.

## Considered Options

- Restore `activitySignal` on listeners so a callback can be bound or unbound without stopping the Injection. Rejected: the command already starts and stops the Injection, and a listener callback error does not unbind the listener (see ADR 0002).
- Give each attached listener its own `start` / `stop`. Rejected: an attached listener starts when its component has mounted and stops when that component stops. `statusHandle(name).attachedListener(name)` can be subscribed to, and cannot be started or stopped on its own. A standalone listener is itself an Injection and uses its own command.

## Consequences

- A component unmount drops its status subscriptions before the following `idle` or cleanup-failure status is written, so the component does not observe that write.
- Do not add a user-facing signal tree for "is this feature active". Internal cancellation of one execution is not that API.
