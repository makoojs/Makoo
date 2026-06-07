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

## Top-Level Manifest

Use `defineInjections()` from `@makoojs/cli`:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	globalInjector: {
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
| `globalInjector` | Runtime defaults for this manifest's injection set |
| `injections` | Object or array of injection module configs |

`globalInjector` supports `alive`, `scope`, `timeout`, and `hooks`. These defaults are used
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

## Module-Level Manifest

A module can provide its own `manifest.ts`:

```ts
// injections/profile-card/manifest.ts
export default {
	injectAt: '.profile',
	component: './app.vue',
	alive: true
};
```

Module-level manifests are useful when a module should own its own target, component path,
URL rule, or runtime options. Paths in a module-level manifest are resolved from the module
directory.

If a module-level manifest has the same module id as a top-level manifest entry, the
module-level config replaces the top-level resolved module. If it introduces a new module id,
Makoo adds it to the final injection list.

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
| `on` | No | Event listener binding options |

## Component Paths

In the top-level manifest, component paths are resolved from `injections/manifest.ts`:

```ts
component: './profile-card/app.vue'
```

In a module-level manifest, component paths are resolved from that module directory:

```ts
// injections/profile-card/manifest.ts
export default {
	component: './app.vue',
	injectAt: '.profile'
};
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

Modules inherit `alive`, `scope`, and `timeout` from `globalInjector` or the project-level
injector config. Set them on a module when that module needs different behavior:

```ts
export default defineInjections({
	globalInjector: {
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
> **Inheritance priority**: `module config` > `manifest.globalInjector` >
> `vite.config.ts injector` > `Makoo default`.

> [!WARNING]
> This priority may change in a later version. The current names can be confusing, and the
> responsibilities between project-level injector defaults and manifest-level injector
> defaults may be adjusted or simplified.

## Hooks

Hooks can be global or module-level:

```ts
export default defineInjections({
	globalInjector: {
		hooks: {
			'run:start': (payload) => {
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

After scanning and merging, Makoo removes disabled modules. If no enabled modules remain,
the scan fails with a clear error.
