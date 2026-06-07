# Core Concepts

Makoo has a small set of concepts, but they work together as one pipeline: project config
describes how Makoo should scan and build, the manifest describes what should be injected,
the generated runtime registers those injections, and the injector mounts them when the
target page is ready.

```txt
vite.config.ts
   -> scan injections/
   -> load manifest
   -> generate runtime entry
   -> register tasks
   -> wait for target DOM
   -> mount with Vue or React adapter
```

Understanding this flow makes the rest of the guide much easier to read.

## Project Config

Makoo's project-level configuration lives in `vite.config.ts` through the `makoo()` plugin:

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1'
	},
	source: {
		include: ['*']
	},
	injector: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	monkey: {
		userscript: {
			match: ['https://example.com/*']
		}
	}
});
```

Use this file for project-wide behavior:

- `app` describes the Makoo app metadata.
- `source` controls which injection modules Makoo scans.
- `injector` sets runtime defaults shared by modules.
- `monkey` is passed to `vite-plugin-monkey` for userscript metadata, dev server behavior,
  and build behavior.

This config answers "How should this project run and build?" It should not become the place
where every module's page-specific injection behavior is defined.

## Manifest

The manifest is the declaration of what gets injected. The top-level
`injections/manifest.ts` describes the modules in your project:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		header: {
			injectAt: '#header',
			component: './header/app.vue'
		},
		badge: {
			injectAt: 'body',
			component: './badge/app.tsx',
			match: {
				include: ['https://example.com/profile/*']
			}
		}
	}
});
```

Use the manifest for module-level behavior:

- which modules exist
- which component each module mounts
- which DOM selector each module waits for
- whether a module is enabled
- module-level URL matching
- module-level runtime options such as `alive`, `scope`, `timeout`, `hooks`, and event
  binding

In short: `vite.config.ts` configures the project, while `injections/manifest.ts` configures
the injection modules.

## Injection Module

An injection module is one feature or mount point in the userscript. It usually maps to one
directory under `injections/`:

```txt
injections
├─ manifest.ts
├─ profile-card
│  └─ app.vue
└─ react-badge
   ├─ app.tsx
   └─ style.css
```

A module should own the code needed for that injection point: component, styles, local
helpers, and optional module-level manifest data. This keeps large userscripts from turning
into one file that knows about every target page and every feature.

The module name comes from the manifest key in object form:

```ts
defineInjections({
	injections: {
		'profile-card': {
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	}
});
```

or from the `name` field in array form:

```ts
defineInjections({
	injections: [
		{
			name: 'profile-card',
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	]
});
```

## Injector

`Injector` is Makoo's runtime scheduler. It is responsible for turning resolved modules into
running tasks.

At runtime, the injector:

- registers component tasks and listener tasks
- waits for each `injectAt` selector to appear
- marks tasks as `idle`, `pending`, or `active`
- asks the matching adapter to mount the component
- exposes a Makoo context to mounted components
- resets or destroys tasks when needed
- enables reinjection when `alive` is active

Most users do not instantiate `Injector` manually in a normal Makoo project. The Vite plugin
generates the runtime entry that creates and runs it. You interact with the injector through
manifest options and, when needed, the `makoo` context passed through the adapter.

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

You usually configure tasks indirectly through manifest fields. The runtime uses them to
coordinate DOM readiness, mount behavior, listeners, and cleanup.

## Adapter

An adapter is the bridge between Makoo's runtime and a component framework. Makoo does not
hard-code Vue or React mounting inside the injector. Instead, an adapter says:

- whether it can handle a component artifact
- how to mount that artifact into a Makoo-created mount point
- how to unmount it during reset, destroy, or remount

Makoo currently provides adapters through `@makoojs/vue` and `@makoojs/react`.

Mounted components receive a Makoo context from the adapter. That context includes the task
id, target selector, lifecycle controls such as `reset()` and `destroy()`, hook registration
helpers, a logger, and listener controls.

## Alive Reinjection

Host pages often redraw or replace DOM after your userscript has already mounted. `alive`
is Makoo's reinjection mechanism for that situation.

When `alive` is enabled for a module, Makoo observes the target area and can remount the
module when the previous mount is no longer alive. The observation range is controlled by
`scope`:

| Scope | Meaning |
| --- | --- |
| `local` | Observe near the target area |
| `global` | Observe the wider document |

Use `alive` for pages that frequently replace content. Leave it disabled for stable targets
to avoid unnecessary observation work.

## Hooks

Hooks let you observe Makoo's lifecycle events. They are useful for logging, debugging,
analytics, or coordinating behavior around registration, run, mount, listener, and DOM
events.

Hooks can be configured globally through the project injector config, or per module through
the manifest:

```ts
defineInjections({
	globalInjector: {
		hooks: {
			'run:start': (payload) => {
				console.log('[makoo] run started', payload);
			}
		}
	},
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			hooks: {
				'artifact:mountSuccess': (payload) => {
					console.log('[makoo] panel mounted', payload);
				}
			}
		}
	}
});
```

Global hooks are good for project-wide observation. Module hooks are better when the logic
belongs to one injection module.

## How The Pieces Fit

The main boundary to remember is:

| Layer | File | Responsibility |
| --- | --- | --- |
| Project config | `vite.config.ts` | Build, scan, global defaults, userscript metadata |
| Injection config | `injections/manifest.ts` | Modules, targets, components, module behavior |
| Runtime | Generated entry and `Injector` | Register, wait, mount, reinject, cleanup |
| Framework bridge | Vue or React adapter | Mount and unmount framework components |

This separation is what makes Makoo a framework layer rather than only a helper library. It
defines how a userscript project is configured, organized, generated, and run.
