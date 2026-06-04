<p align="center">
  <img width="150" src="./demo/assets/makoo-icon-transparent.png">
</p>

<h1 align="center">Makoo</h1>
<p align="center">A component injection framework for userscripts</p>

<div align="center">
  <a href="https://github.com/FlowingInk/makoo/"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/FlowingInk/makoo?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@makoo/cli"><img alt="NPM Version" src="https://img.shields.io/npm/v/@makoo/cli"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</div>

<div align="center">
  English | <a href="./README.CN.md">中文</a>
</div>

---

Makoo helps you inject modern Vue and React components into existing web pages. It is especially designed for userscript environments such as Tampermonkey, Violentmonkey, and ScriptCat.

It focuses on the part of userscript development that tends to get messy: waiting for target DOM nodes, mounting components, handling page redraws, managing injection modules, and keeping structural changes hot-updated during development. Build output, userscript metadata, and install flows are still handled by [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey); Makoo adds a component injection layer on top.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Project Structure](#project-structure)
- [Configuration Overview](#configuration-overview)
- [Manifest Reference](#manifest-reference)
- [HMR Behavior](#hmr-behavior)
- [Recipes](#recipes)
- [Packages](#packages)
- [Special Thanks](#special-thanks)
- [Development](#development)
- [License](#license)

## Quick Start

Create a project with the scaffold:

```bash
pnpm dlx @makoo/create-makoo
```

Then enter the project and start the dev server:

```bash
pnpm install
pnpm dev
```

A minimal project usually looks like this:

```txt
.
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   └─ hello-world
      └─ app.vue
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoo/cli';
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

`injections/manifest.ts`:

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: {
		'hello-world': {
			injectAt: 'body',
			component: './hello-world/app.vue'
		}
	}
});
```

`injections/hello-world/app.vue`:

```vue
<template>
	<div class="hello-world">Hello from Makoo</div>
</template>

<style scoped>
.hello-world {
	position: fixed;
	right: 24px;
	bottom: 24px;
	z-index: 9999;
	padding: 12px 16px;
	background: white;
	border: 1px solid #d1d5db;
	border-radius: 8px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
</style>
```

## Core Concepts

`Injector` is Makoo's runtime scheduler. It registers injection tasks, waits for target nodes, asks the matching adapter to mount components, and handles reinjection when needed.

`Injection Module` is a single injection unit. A module usually maps to a component under `injections/<module-name>/`, and it may also provide its own module-level `manifest.ts`.

`Manifest` is the declarative injection configuration. The top-level `injections/manifest.ts` describes which modules should be injected; module-level files such as `injections/foo/manifest.ts` can override a single module.

`Adapter` is the component mounting bridge. Makoo supports Vue and React through `@makoo/vue` and `@makoo/react`, and the adapter model can support other mountable artifacts later.

## Project Structure

The recommended structure keeps all injection modules under `injections/`:

```txt
injections
├─ manifest.ts
├─ profile-card
│  ├─ app.vue
│  └─ manifest.ts
└─ react-badge
   ├─ app.tsx
   └─ manifest.ts
```

Use the top-level `manifest.ts` as the project entry configuration. Use module-level `manifest.ts` files when a module should own fields such as `injectAt`, `framework`, `match`, or `hooks`.

## Configuration Overview

Makoo's Vite plugin config has four main areas:

```ts
makoo({
	app: {
		name: 'my-script',
		version: '0.0.1'
	},
	source: {
		include: ['*'],
		exclude: []
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

`app` is used to generate userscript metadata such as name, version, and description.

`source` controls where Makoo scans injection modules. Its current `include` and `exclude` fields filter module directories, not page URLs.

`injector` defines global defaults. Modules inherit `alive`, `scope`, `timeout`, and `hooks` when they do not set them explicitly.

`monkey` is passed through to [`vite-plugin-monkey`](https://github.com/lisonge/vite-plugin-monkey) for userscript metadata, dev server behavior, and build behavior.

## Manifest Reference

The top-level manifest supports both object and array forms.

Object form is recommended for most projects:

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	globalInjector: {
		alive: false,
		scope: 'local'
	},
	injections: {
		header: {
			injectAt: '#header',
			component: './header/app.vue',
			framework: 'Vue'
		},
		badge: {
			injectAt: 'body',
			component: './badge/app.tsx',
			framework: 'React',
			match: {
				include: ['https://example.com/profile/*'],
				exclude: ['https://example.com/profile/settings']
			}
		}
	}
});
```

Array form is useful when entries are generated or need an explicit `name`:

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: [
		{
			name: 'header',
			injectAt: '#header',
			component: './header/app.vue',
			framework: 'Vue'
		}
	]
});
```

Common module fields:

| Field | Description |
| --- | --- |
| `injectAt` | Target selector for injection |
| `component` | Component path relative to `injections/manifest.ts` or the module directory |
| `framework` | `Vue`, `React`, or `auto`; when omitted, Makoo infers it from the component extension |
| `enabled` | Whether the module is enabled, defaults to `true` |
| `alive` | Whether to retry injection after target DOM changes |
| `scope` | Reinjection observation scope, supports `local` and `global` |
| `timeout` | Timeout for waiting for the target node |
| `hooks` | Lifecycle hooks for the current module |
| `match` | URL matching rule for the current module |

Module-level URL `match` supports shorthand and object forms:

```ts
match: ['https://example.com/*']
```

```ts
match: {
	include: ['https://example.com/*'],
	exclude: ['https://example.com/admin/*']
}
```

When `match` is omitted, the module is registered on pages where the userscript itself runs. When `match` is provided, Makoo checks `location.href` at runtime before registering that module.

The complete API reference will move to a dedicated documentation site. This README keeps only the common configuration and usage path.

## HMR Behavior

Makoo separates structural changes from regular component updates in dev mode.

| Change | Behavior |
| --- | --- |
| Top-level `injections/manifest.ts` changes | Rescan and update the virtual entry |
| Module-level `injections/foo/manifest.ts` changes | Rescan and update the virtual entry |
| Local helper or hooks imported by a manifest changes | Recursively track the local dependency and rescan |
| Module-level `manifest.ts` is added or removed | Trigger a structural update |
| Regular component file changes | Let Vite handle native HMR |
| Third-party package dependency changes | Not tracked by Makoo structural scanning |

When splitting hooks into a separate file, prefer static relative imports:

```ts
import { hooks } from './hooks';
```

Makoo tracks local chains such as `manifest -> hooks -> helper`. Dynamic `import()`, path aliases, and third-party packages are not part of Makoo's structural dependency tracking.

## Recipes

### Enable a Module by URL

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: {
		profile: {
			injectAt: '#app',
			component: './profile/app.vue',
			match: {
				include: ['https://example.com/users/*'],
				exclude: ['https://example.com/users/settings']
			}
		}
	}
});
```

### Use a Vue Module

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			framework: 'Vue'
		}
	}
});
```

### Split Hooks

```ts
// injections/hooks.ts
export const hooks = {
	'run:start': () => {
		console.log('[makoo] injector started');
	}
};
```

```ts
// injections/manifest.ts
import { hooks } from './hooks';
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	globalInjector: {
		hooks
	},
	injections: {
		'hello-world': {
			injectAt: 'body',
			component: './hello-world/app.vue'
		}
	}
});
```

### Reduce Bundle Size with `externalGlobals`

`monkey.build.externalGlobals` and `externalResource` are passed through to `vite-plugin-monkey`:

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoo/cli';

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

### Use GM APIs

Makoo exposes `@makoo/cli/monkey` as a stable entry for `vite-plugin-monkey` GM APIs. Prefer capability-level imports so the final userscript only references the GM APIs it actually uses:

```ts
import { gmRequest, gmStorage, gmStyle } from '@makoo/cli/monkey';

gmStyle.add('.makoo-panel { z-index: 999999; }');

gmStorage.set('token', 'abc');
const token = gmStorage.get<string>('token');

gmRequest.get('https://api.example.com/data', {
	responseType: 'json',
	onload(event) {
		console.log(event.response);
	}
});
```

You can also use the grouped entry:

```ts
import { GMapi } from '@makoo/cli/monkey';

GMapi.storage.set('enabled', true);
```

`@grant` is still generated by `vite-plugin-monkey` from the final code; development does not require manually mounting global `GM_*` APIs.

## Packages

| Package | Responsibility |
| --- | --- |
| `@makoo/core` | Framework-agnostic injection runtime |
| `@makoo/vue` | Vue mount adapter |
| `@makoo/react` | React mount adapter |
| `@makoo/cli` | Vite plugin, config resolution, scanning, and code generation |
| `@makoo/create-makoo` | Project scaffold |

Most userscript projects should start with `@makoo/cli`. You usually only need to touch `@makoo/core`, `@makoo/vue`, or `@makoo/react` for custom runtime integrations.

## Special Thanks

Makoo is built on top of these excellent open-source projects:

| Project | What it provides |
| --- | --- |
| [Vite](https://vite.dev/) | Modern frontend development and build tooling |
| [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) | Userscript build, metadata generation, and dev workflow |
| [Vue](https://vuejs.org/) | Vue component ecosystem and runtime |
| [React](https://react.dev/) | React component ecosystem and runtime |
| [Vitest](https://vitest.dev/) | Test runner |
| [jiti](https://github.com/unjs/jiti) | TypeScript manifest loading |
| [picomatch](https://github.com/micromatch/picomatch) | Module directory matching |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Common commands:

| Command | Description |
| --- | --- |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm demo:dev` | Start the demo |
| `pnpm demo:build` | Build the demo into `docs/` |
| `pnpm lint:fix` | Run Biome checks and fixes |

## License

[MIT](./LICENSE)
