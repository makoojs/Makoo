# @makoojs/cli

`@makoojs/cli` is the main entry point for Makoo projects. It provides the Vite plugin, CLI commands, manifest type helpers, injection scanning, virtual entry generation, and connects userscript development, build, and install flows to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).

If you are building a regular Makoo userscript project, you should usually start from this package. `@makoojs/core` provides the low-level injection runtime, `@makoojs/vue` and `@makoojs/react` provide component mounting adapters, and `@makoojs/cli` organizes them into the Vite and userscript build flow.

## Use Cases

- Develop Makoo userscript projects with Vite.
- Scan injection modules from the `injections` directory and generate runtime code.
- Write `injections/manifest.ts` and module-level `manifest.ts` files.
- Generate userscript metadata, dev entries, and build output through [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).
- Use commands such as `makoo dev`, `makoo build`, `makoo add`, and `makoo inspect`.
- Use Makoo's stable GM API entry through `@makoojs/cli/monkey`.

## Installation

```bash
// npm install @makoojs/cli
// yarn add @makoojs/cli
pnpm add @makoojs/cli
```

If you create a project with `@makoojs/create-makoo`, `@makoojs/cli` is usually configured for you.

## Minimal Vite Config

`makoo()` returns an array of Vite plugins, so it is usually spread into `plugins` with `...makoo(...)`.

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		...makoo({
			app: {
				name: 'my-userscript',
				version: '0.0.1',
				description: 'My first Makoo script'
			},
			monkey: {
				userscript: {
					namespace: 'https://example.com',
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

`makoo()` first injects Makoo's own scanning and virtual entry plugin, then connects to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) for userscript development and build behavior.

## Recommended Project Structure

Makoo scans the `injections` directory under the project root by default.

```txt
.
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   ├─ profile-card
   │  ├─ app.vue
   │  └─ manifest.ts
   └─ react-badge
      ├─ app.tsx
      └─ manifest.ts
```

The top-level `injections/manifest.ts` declares manifest-scoped injection defaults and the module list. A module-level `injections/<module>/manifest.ts` can override or add config for a single module, which is useful when a module should own fields such as `injectAt`, `component`, `framework`, `match`, or lifecycle hooks.

## Manifest Basics

`@makoojs/cli` exports `defineInjections()` and `defineInjection()` to provide type constraints for manifests.

`injectionDefaults` defines shared injection runtime defaults for the current manifest. Modules inherit `alive`, `scope`, `timeout`, and `hooks` from it unless they override those fields themselves.

Object form is suitable for most projects:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injectionDefaults: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	injections: {
		profile: {
			injectAt: '#app',
			component: './profile-card/app.vue',
			framework: 'Vue',
			match: {
				include: ['https://example.com/users/*'],
				exclude: ['https://example.com/users/settings']
			}
		},
		badge: {
			injectAt: 'body',
			component: './react-badge/app.tsx',
			framework: 'React'
		}
	}
});
```

Array form is useful for generated entries or cases where you need to declare `name` explicitly:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: [
		{
			name: 'profile',
			injectAt: '#app',
			component: './profile-card/app.vue',
			framework: 'Vue'
		}
	]
});
```

Module-level manifests can use `defineInjection()`:

```ts
import { defineInjection } from '@makoojs/cli';

export default defineInjection({
	injectAt: '#app',
	component: './app.vue',
	framework: 'Vue',
	alive: true
});
```

Common fields:

| Field | Description |
| --- | --- |
| `injectAt` | Target DOM selector |
| `component` | Component path, relative to the top-level manifest or the module directory |
| `framework` | `Vue`, `React`, or `auto`; when omitted, Makoo infers it from the file extension |
| `enabled` | Whether the module is enabled, defaults to `true` |
| `match` | Module-level URL matching rule |
| `alive` | Whether to retry injection after the target DOM is removed |
| `scope` | Alive observation scope, supports `local` and `global` |
| `timeout` | Timeout for waiting for the target DOM |
| `hooks` | Lifecycle observation hooks passed to `@makoojs/core` |

`match` supports array shorthand:

```ts
match: ['https://example.com/*']
```

It also supports an include/exclude object:

```ts
match: {
	include: ['https://example.com/*'],
	exclude: ['https://example.com/admin/*']
}
```

`match` is a module-level filter. Which pages the userscript itself runs on is still controlled by userscript metadata such as `monkey.userscript.match`.

## Configuration Overview

`makoo()` has four main config areas:

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1',
		description: 'demo script'
	},
	source: {
		include: ['*'],
		exclude: []
	},
	runtime: {
		setup: ['./injections/vue-setup.ts']
	},
	monkey: {
		userscript: {
			match: ['https://example.com/*']
		}
	}
});
```

| Config | Description |
| --- | --- |
| `app` | Generates userscript `name`, `version`, and `description` |
| `source` | Controls which injection module directories are scanned |
| `runtime` | Controls runtime setup imports in the Makoo-generated entry |
| `monkey` | Most options are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) |

`source.include` and `source.exclude` filter module directory names under `injections`, not page URLs. The default include is `['*']`, and the default exclude is `[]`.

Most `monkey` options are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) for userscript metadata, dev server behavior, and build behavior. However, Makoo manages these fields internally:

- `entry`: fixed to the virtual entry generated by Makoo.
- `clientAlias`: fixed to the GM API alias used internally by Makoo.
- `server.mountGmApi`: managed by Makoo and not user-configurable.

By default, `monkey.build.autoGrant` is `true`, so [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) generates `@grant` from the final code.

## CLI Commands

After installation, you can use the `makoo` command:

| Command | Description |
| --- | --- |
| `makoo dev` | Starts the Vite dev server and prints the local URL |
| `makoo build` | Runs Vite build and generates userscript output |
| `makoo add <name>` | Creates a new injection module and updates the manifest |
| `makoo add <name> --framework Vue` | Creates a Vue injection module |
| `makoo add <name> --framework React` | Creates a React injection module |
| `makoo inspect` | Prints the resolved Makoo config and scanner result |

`makoo add` uses React by default. It creates a component file under `injections/<name>` and writes the module record to `injections/manifest.ts`.

## Scanning And Generation Flow

Makoo's Vite plugin runs this flow during dev startup and build:

1. Load `injections/manifest.ts`.
2. Scan module directories under `injections` that match `source.include` / `source.exclude`.
3. Read module-level `manifest.ts` files and merge them with the top-level manifest.
4. Resolve component paths, module IDs, framework, match, alive, scope, timeout, and related config.
5. Generate adapter imports based on the frameworks actually used.
6. Generate a virtual entry, create an `Injector`, register components, and call `run()`.
7. Hand the virtual entry to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) so it can be bundled as a userscript.

If the top-level manifest is missing, no enabled injection modules are found, or the framework cannot be inferred, the CLI throws Makoo's own error types to make the issue easier to locate.

## HMR Behavior

In dev mode, Makoo separates structural changes from normal component updates.

| Change | Behavior |
| --- | --- |
| Top-level `injections/manifest.ts` changes | Rescan and update the virtual entry |
| Module-level `injections/<module>/manifest.ts` changes | Rescan and update the virtual entry |
| Local helpers statically imported by a manifest change | Track dependencies, rescan, and update the virtual entry |
| Module directory is added or removed | Rescan and update the virtual entry |
| Regular component files change | Let Vite handle native HMR |
| Third-party dependencies change | Not tracked as Makoo structural scan dependencies |

Structural changes update the virtual entry. Changes inside regular components keep Vite's own hot update experience.

## Runtime Setup

`runtime.setup` imports side-effect-only runtime files before Makoo initializes adapters, registers injections, and calls `injector.run()`.

Use it to register Vue plugins, initialize GM helpers, import global styles, or run analytics setup.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		...makoo({
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			runtime: {
				setup: ['./injections/vue-setup.ts']
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

```ts
// injections/vue-setup.ts
import { VuePlugin } from '@makoojs/vue';
import router from './router';
import i18n from './i18n';

VuePlugin.usePlugins(router, i18n);
```

`runtime.setup` supports a string or an array of strings. Relative paths are resolved from the project root:

```ts
runtime: {
	setup: [
		'./injections/vue-setup.ts',
		'./injections/gm-setup.ts'
	]
}
```

In dev mode, setup files and their statically imported local dependencies participate in structural updates. When these files change, Makoo rescans and updates the virtual entry.

## Use GM APIs

`@makoojs/cli` provides the `@makoojs/cli/monkey` subpath as Makoo's stable wrapper around [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM APIs.

```ts
import { gmStorage, gmStyle } from '@makoojs/cli/monkey';

gmStyle.add('.makoo-panel { z-index: 999999; }');
gmStorage.set('enabled', true);
```

You can also use the grouped entry:

```ts
import { GMapi } from '@makoojs/cli/monkey';

GMapi.storage.set('enabled', true);
```

Prefer capability-level imports when you want the generated `@grant` surface to stay as small as possible. `GMapi` is more convenient for shared code or exploratory work. The complete GM API reference will be moved to a dedicated documentation site later.

## Reduce Build Size

`@makoojs/cli` re-exports the `cdn` helper from [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey). You can use it with `monkey.build.externalGlobals` to load external dependencies from a CDN and reduce userscript bundle size.

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: makoo({
		app: {
			name: 'my-script',
			version: '0.0.1'
		},
		monkey: {
			build: {
				externalGlobals: {
					vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js')
				}
			}
		}
	})
});
```

## Relationship To Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/cli` | Vite plugin, CLI commands, scanning, code generation, and userscript build integration |
| `@makoojs/core` | Framework-agnostic injection runtime core |
| `@makoojs/vue` | Vue adapter and Vue plugin registration helpers |
| `@makoojs/react` | React adapter |
| `@makoojs/create-makoo` | Project scaffold |

`@makoojs/cli` is not a complete runtime implementation by itself. Many features cannot exist independently and rely on the injection scheduling capabilities provided by `@makoojs/core`.
