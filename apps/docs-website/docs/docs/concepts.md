# Core Concepts

Makoo has a small set of concepts that work together as one pipeline: project config selects
the application file and userscript options; `createMakoo()`, `inject()`, and `listen()` provide
runtime composition; after the application calls `start()`, Makoo registers the tasks, waits for
each target DOM node, and mounts the matching artifacts.

```txt
vite.config.ts
   -> load the configured application module
   -> register tasks
   -> wait for target DOM
   -> mount with Vue or React adapter
```

## Project Config

Makoo's project-level configuration lives in `vite.config.ts` through the `makoo()` plugin:

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/main.ts',
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

Use this file for project-wide behavior:

- `app` describes the Makoo app metadata.
- `entry` selects the application module Vite loads.
- Makoo applies defaults and normalizes the supported `monkey` options before passing them to
  `vite-plugin-monkey` for userscript metadata, dev server behavior, and build behavior.

This config answers "How should this project run and build?" `createMakoo()`, `inject()`, and
`listen()` configure runtime task behavior.

## Runtime Composition

A Vue project can compose several tasks like this:

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Header from './injections/header/App.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({
		id: 'header',
		injectAt: '#header',
		artifact: Header,
		options: { alive: true, timeout: 5000 }
	})
]);
```

Runtime composition covers:

- which tasks exist
- which component each task mounts
- which DOM selector each module waits for
- task options such as `alive`, `scope`, `timeout`, `hooks`, and event binding

`vite.config.ts` configures the toolchain. `createMakoo()`, `inject()`, and `listen()` provide
runtime composition.

## Injection Module

An injection module is an independent feature or mount point in the userscript. It can include
components, styles, and related application logic. Projects can organize this code as needed. For example:

```txt
src/injections
├─ profile-card
│  └─ App.vue
└─ react-badge
   ├─ App.tsx
   └─ style.css
```

The task id is declared explicitly in `inject()`:

```ts
inject({ id: 'profile-card', injectAt: '.profile', artifact: ProfileCard });
```

## Makoo Runtime

`createMakoo()` creates the runtime scheduler and starts task declarations through
`createMakoo().start(...)`.

At runtime, Makoo:

- declares component tasks and listener tasks with `inject()` and `listen()`
- waits for each `injectAt` selector to appear
- marks tasks as `idle`, `pending`, or `active`
- asks the matching adapter to mount the component
- exposes a Makoo context to mounted components
- resets or destroys tasks when needed
- reinjects after removal of a host target when `alive` is active

A typical project imports the required adapters, builds the task list, and calls
`makoo.start(tasks)`. Mounted components can also interact with the runtime through the
`makoo` context passed by the adapter.

## Task

A task is the runtime record created from a registered module or listener. Component tasks
contain the target selector, component artifact, adapter, timeout, alive settings, and mount
state.

Task state is intentionally simple:

| Status | Meaning |
| --- | --- |
| `idle` | Registered, but not currently waiting or mounted |
| `pending` | Waiting for the target DOM node |
| `active` | Target found and module mounted or listener attached |

You configure tasks with `inject()` and `listen()`. The runtime uses them to
coordinate DOM readiness, mount behavior, listeners, and cleanup.

## Adapter

An adapter bridges Makoo's runtime and a component framework. It defines:

- whether it can handle a component artifact
- how to mount that artifact into a Makoo-created mount point
- how to unmount it during reset, destroy, or remount

Makoo currently provides adapters through `@makoojs/vue` and `@makoojs/react`.

Mounted components receive a Makoo context from the adapter. That context includes the task
id, target selector, lifecycle controls such as `reset()` and `destroy()`, hook registration
functions, a logger, and listener controls.

## Alive Reinjection

`alive` handles host target nodes that are removed and recreated after mounting.

When `alive` is enabled for a module, Makoo observes the matched host target. After that node is
removed, Makoo waits for the same `injectAt` selector to appear again and attempts another mount.
`scope` controls the removal observation range:

| Scope | Meaning |
| --- | --- |
| `local` | Observe near the target area |
| `global` | Observe the wider document |

Enable `alive` when the host page removes and recreates the target node. Leave it disabled for
stable targets to avoid unnecessary observation work.

## Hooks

Hooks let you observe Makoo's lifecycle events. They are useful for logging, debugging,
analytics, or coordinating behavior around registration, run, mount, listener, and DOM
events.

Hooks can be configured globally when creating Makoo or on a specific task:

```ts
const makoo = createMakoo({
	hooks: {
		'start:requested': (payload) => console.log(payload)
	}
});

makoo.start([
	inject({
		id: 'panel',
		injectAt: 'body',
		artifact: Panel,
		options: {
			hooks: {
				'artifact:mountSuccess': (payload) => console.log(payload)
			}
		}
	})
]);
```

Global hooks are good for project-wide observation. Module hooks are better when the logic
belongs to one injection module.

## How The Pieces Fit

The responsibilities are:

| Layer | File | Responsibility |
| --- | --- | --- |
| Project config | `vite.config.ts` | Application file, userscript metadata, build and dev options |
| Task composition | `@makoojs/core` | Create the runtime, declare tasks, and start Makoo |
| Runtime | Makoo core | Wait, mount, reinject, and clean up tasks |
| Framework bridge | Vue or React adapter | Mount and unmount framework components |

Together, these parts configure the userscript, compose tasks, mount components, and clean up.
