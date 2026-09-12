# Core Concepts

A Makoo project has two flows: the toolchain delivers the application to a script manager, and the browser Runtime executes tasks.

```text
vite.config.ts → Vite / Monkey → development script or build output
                                      ↓ loaded by the manager on matching pages
src/main.ts → createMakoo() → start([...]) → wait for target → mount or bind events
```

## Configuration: where the script runs

`monkey.userscript.match` determines the URLs where the script manager loads the script; `entry` selects the application entry. Ports, output directories, and script metadata belong to the toolchain. See [Configuration](./configuration.md).

`@match` matches page URLs; `injectAt` matches DOM elements inside the page. They are separate conditions.

## Declarations: what to run

- `inject({ ... })` describes a component and its target selector.
- `listen({ ... })` describes an event target, event type, and callback.

Both return task declarations. The Runtime registers and runs them only when you pass them to `start()`.

## Runtime: who manages tasks

`createMakoo()` returns a Runtime. It holds tasks, defaults, adapters, and lifecycle event subscriptions. A page can create multiple Runtimes; a task ID identifies a task within its own Runtime.

`start()` returns the handles for that batch as `StartedTasks`. Calling `destroyAll()` on the batch cleans up only those tasks; calling it on the Runtime cleans up all tasks in that Runtime.

## Adapter: who mounts components

Core creates a mount point. A Vue or React adapter mounts the component there and unmounts it during task cleanup. The component receives its task Context through the `makoo` prop.

See [Component Injection](./injection.md).

## Status: what a task is doing

| Status | Meaning |
| --- | --- |
| `idle` | Not currently waiting, mounted, or listening |
| `pending` | Waiting for a target element |
| `active` | Component mounted or listener attached |

Status describes a stage, not a complete failure diagnosis. Use browser errors and lifecycle events when investigating. See [Troubleshooting](./troubleshooting.md).

## Next steps

Build a feature with [Component Injection](./injection.md) or [Event Listeners](./listeners.md). Then decide whether the host page replaces target nodes and needs [alive](./lifecycle.md).
