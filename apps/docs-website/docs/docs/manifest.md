# Manifest Reference

The manifest declares the injection modules in a Makoo project. The top-level manifest lives
in `injections/manifest.ts`, and module-level manifests can live in
`injections/<module>/manifest.ts`.

```txt
injections
├─ manifest.ts
├─ header
│  ├─ app.vue
│  └─ manifest.ts
└─ badge
   └─ app.tsx
```

Makoo loads the top-level manifest first, then scans module folders and merges module-level
manifests by `moduleId`.

## Loading

Makoo scans manifests and generates the startup entry automatically. It loads manifests in Node
to validate configuration and resolve paths. Their `hooks`, `callback`, and `activitySignal`
fields are bundled with the userscript and run in the browser.

Keep manifests safe across both environments:

- Keep top-level evaluation declarative and free of application side effects.
- Do not import `node:fs`, `node:path`, or other Node-only modules.
- Ensure `hooks`, `callback`, `activitySignal`, and every file they import can be bundled for the browser.
- Prefer static relative imports so Makoo can track structural dependency changes.

## Top-Level Manifest

Use `defineInjections()` from `@makoojs/cli/manifest`:

```ts
import { defineInjections } from '@makoojs/cli/manifest';

export default defineInjections({
	injectionDefaults: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
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

| Field | Description |
| --- | --- |
| `injectionDefaults` | Runtime defaults for this manifest's injection set |
| `injections` | Object or array of injection module configs |
| `listeners` | Object or array of standalone listener configs |

`injectionDefaults` supports `alive`, `scope`, `timeout`, and `hooks`. These defaults are used
when a module does not set the same field itself.

## Object Form

Object form is recommended for most projects because the object key becomes the module name.

```ts
export default defineInjections({
	injections: {
		'profile-card': {
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	}
});
```

This resolves to a module with `moduleId: 'profile-card'`.

## Array Form

Array form is useful when entries are generated or when order in source code is easier to
maintain as a list.

```ts
export default defineInjections({
	injections: [
		{
			name: 'profile-card',
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	]
});
```

When using array form, provide `name` when you need a stable module id.

## Standalone Listeners

Use top-level `listeners` for event tasks that do not belong to an injection module. They do
not need a component directory or a framework adapter:

```ts
export default defineInjections({
	listeners: {
		escapeClose: {
			listenAt: 'document',
			type: 'keydown',
			callback: (event) => {
				if (event instanceof KeyboardEvent && event.key === 'Escape') console.log('close');
			},
			match: ['https://example.com/*']
		}
	}
});
```

In object form, the key becomes `listenerId`, so this entry generates
`listen({ id: 'escapeClose', ... })`. Array form uses `name` for the same purpose. Listener
entries support `listenAt`, `type`, `callback`, `activitySignal`, `enabled`, and `match`.

Standalone listeners are top-level manifest entries only. Use a module's `on` field when the
listener belongs to that component task; `on` does not need an explicit listener ID.

## Module-Level Manifest

A module can provide its own `manifest.ts`:

```ts
// injections/profile-card/manifest.ts
import { defineInjection } from '@makoojs/cli/manifest';

export default defineInjection({
	injectAt: '.profile',
	component: './app.vue',
	alive: true
});
```

Module-level manifests are useful when a module should own its own target, component path,
URL rule, or runtime options. Paths in a module-level manifest are resolved from the module
directory.

If a module-level manifest has the same module id as a top-level manifest entry, Makoo
shallow-merges their top-level fields. An explicitly declared module field wins; a field
omitted by the module can come from the same-id top-level entry. `hooks` and `on` each use one
complete field source, so Makoo does not deep-merge inside either object. An injection declared
by a module manifest but absent from the root manifest is added to the final injection list.

## Module Fields

| Field | Required | Description |
| --- | --- | --- |
| `name` | Array form only | Stable module id |
| `injectAt` | Yes | CSS selector for the target node |
| `component` | Yes | Component path relative to the manifest location |
| `framework` | No | `'auto'`, `'Vue'`, or `'React'` |
| `enabled` | No | Whether the module is included, defaults to `true` |
| `match` | No | Module-level URL rule |
| `alive` | No | Whether this module should reinject |
| `scope` | No | Reinjection observation scope, `'local'` or `'global'` |
| `timeout` | No | Milliseconds to wait for the target node |
| `hooks` | No | Module-level lifecycle hooks |
| `on` | No | Component event listener options |

## Component Paths

In the top-level manifest, component paths are resolved from `injections/manifest.ts`:

```ts
component: './profile-card/app.vue'
```

In a module-level manifest, component paths are resolved from that module directory:

```ts
// injections/profile-card/manifest.ts
import { defineInjection } from '@makoojs/cli/manifest';

export default defineInjection({
	component: './app.vue',
	injectAt: '.profile'
});
```

## Framework Resolution

Makoo can infer the framework from the component extension:

| Extension | Framework |
| --- | --- |
| `.vue` | `Vue` |
| `.tsx` | `React` |
| `.jsx` | `React` |

You can set the framework explicitly:

```ts
framework: 'Vue'
```

Use `framework: 'auto'` or omit the field when inference is enough. Makoo throws an error
when it cannot infer the framework from the component path.

## URL Matching

`match` controls whether a module is registered on the current page. It is checked at
runtime against `location.href`.

Shorthand form:

```ts
match: ['https://example.com/profile/*']
```

Object form:

```ts
match: {
	include: ['https://example.com/profile/*'],
	exclude: ['https://example.com/profile/settings']
}
```

Module-level `match` is narrower than `monkey.userscript.match`. The userscript manager must
run the script on the page first; then Makoo can decide which modules inside that script
should register.

## Runtime Options

Modules inherit `alive`, `scope`, and `timeout` from manifest-level `injectionDefaults`.
Set them on a module when that module needs different behavior:

```ts
export default defineInjections({
	injectionDefaults: {
		alive: false,
		timeout: 5000
	},
	injections: {
		stable: {
			injectAt: '#stable',
			component: './stable/app.vue'
		},
		dynamic: {
			injectAt: '#dynamic',
			component: './dynamic/app.vue',
			alive: true,
			scope: 'global',
			timeout: 10000
		}
	}
});
```

`stable` inherits `alive: false` and `timeout: 5000`. `dynamic` overrides those values.

> [!NOTE]
> **Scalar option priority**: explicit module field > same-id top-level injection field >
> `manifest.injectionDefaults` > Makoo default.

`injectionDefaults.hooks` registers shared runtime hooks. Injection-level `hooks` is a
per-task field and follows the module-field priority described above.

## Hooks and Event Callbacks

You can write a function directly here, use a function already declared in the current file,
or use a function imported from another file.

A function can also directly use variables and other utility functions from the file where it
is declared.

When importing a function, ensure its file and dependencies can run in the browser:

```ts
// injections/listeners/callbacks.ts
import { closePanel } from './panel-state';

export const onEscape: EventListener = (event) => {
	if (event instanceof KeyboardEvent && event.key === 'Escape') closePanel();
};
```

```ts
// injections/manifest.ts
import { defineInjections } from '@makoojs/cli/manifest';
import { onEscape } from './listeners/callbacks';

export default defineInjections({
	listeners: {
		escapeClose: {
			listenAt: 'document',
			type: 'keydown',
			callback: onEscape
		}
	}
});
```

## Hooks

Hooks can be global or module-level:

```ts
export default defineInjections({
	injectionDefaults: {
		hooks: {
			'start:requested': (payload) => {
				console.log(payload);
			}
		}
	},
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			hooks: {
				'artifact:mountSuccess': (payload) => {
					console.log(payload);
				}
			}
		}
	}
});
```

Use global hooks for project-wide observation. Use module hooks when the behavior belongs to
one injection module.

## Enabled Modules

Modules are enabled by default. Set `enabled: false` to keep a module in the manifest but
exclude it from the generated runtime:

```ts
export default defineInjections({
	injections: {
		experimental: {
			enabled: false,
			injectAt: 'body',
			component: './experimental/app.vue'
		}
	}
});
```

After scanning and merging, Makoo removes disabled modules and listeners. If no enabled tasks
remain, the scan fails with a clear error.
