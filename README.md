<p align="center">
  <img width="150" src="./apps/docs-website/docs/public/makoo-icon-transparent.png">
</p>

<h1 align="center">Makoo</h1>
<p align="center">A userscript development framework for Tampermonkey, Violentmonkey, and ScriptCat</p>

<div align="center">
  <a href="https://github.com/makoojs/Makoo/"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/makoojs/Makoo?style=flat-square"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</div>

<div align="center">
  English | <a href="./README.CN.md">中文</a>
</div>

---

Makoo is a userscript development framework for building maintainable Vue / React injection apps for browser script managers such as Tampermonkey, Violentmonkey, and ScriptCat.

It focuses on the parts of userscript development that tend to get messy: waiting for target DOM nodes, mounting components, handling page redraws, managing injection modules, and keeping structural changes hot-updated during development. Build output, userscript metadata, and install flows are still handled by [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey); Makoo adds a structured framework layer for component-driven userscript projects.

## When To Use Makoo

Makoo is not meant for simple userscripts. If your script only changes a button, hides an element, or injects a small style block, plain userscript code is often enough.

Makoo is a better fit for userscripts that start behaving like small frontend applications:

- building injected UI with Vue or React to modify existing web pages
- multiple injection points or feature modules on the same page
- host pages that redraw or partially refresh, requiring stable remount behavior
- modules that need to be enabled by URL or page state
- growing codebases that need clear structure, configuration, and development workflow

Makoo becomes useful when lifecycle, module boundaries, and long-term maintenance start to matter.

## Table of Contents

- [When To Use Makoo](#when-to-use-makoo)
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
pnpm dlx @makoojs/create-makoo
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

## Core Concepts

`Injector` is Makoo's runtime scheduler. It registers injection tasks, waits for target nodes, asks the matching adapter to mount components, and handles reinjection when needed.

`Injection Module` is a single injection unit. A module usually maps to a component under `injections/<module-name>/`, and it may also provide its own module-level `manifest.ts`.

`Manifest` is the declarative injection configuration. The top-level `injections/manifest.ts` describes which modules should be injected; module-level files such as `injections/foo/manifest.ts` can override a single module.

`Adapter` is the component mounting bridge. Makoo supports Vue and React through `@makoojs/vue` and `@makoojs/react`, and the adapter model can support other mountable artifacts later.

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

Most `monkey` options are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) for userscript metadata, dev server behavior, and build behavior. Makoo manages `clientAlias` and `server.mountGmApi` internally, so those options are not user-configurable.

## Manifest Reference

The top-level manifest supports both object and array forms.

Object form is recommended for most projects:

```ts
import { defineInjections } from '@makoojs/cli';

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
import { defineInjections } from '@makoojs/cli';

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
import { defineInjections } from '@makoojs/cli';

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
import { defineInjections } from '@makoojs/cli';

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
import { defineInjections } from '@makoojs/cli';

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

`monkey.build.externalGlobals` and `externalResource` are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey):

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

### Use GM APIs

Makoo exposes `@makoojs/cli/monkey` as a stable entry for [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM APIs. Prefer capability-level imports so the final userscript only references the GM APIs it actually uses:

```ts
import { gmRequest, gmStorage, gmStyle } from '@makoojs/cli/monkey';

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

You can also use the grouped entry. Prefer capability-level imports when you want the smallest generated `@grant` surface; `GMapi` is a convenience entry for shared or exploratory code:

```ts
import { GMapi } from '@makoojs/cli/monkey';

GMapi.storage.set('enabled', true);
```

When `monkey.build.autoGrant` is enabled, which is the default, `@grant` is still generated by [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) from the final code. Development does not require manually mounting global `GM_*` APIs.

## Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/core` | Framework-agnostic injection runtime |
| `@makoojs/vue` | Vue mount adapter |
| `@makoojs/react` | React mount adapter |
| `@makoojs/cli` | Vite plugin, config resolution, scanning, and code generation |
| `@makoojs/create-makoo` | Project scaffold |

Most userscript projects should start with `@makoojs/cli`. You usually only need to touch `@makoojs/core`, `@makoojs/vue`, or `@makoojs/react` for custom runtime integrations.

## Special Thanks

Makoo is built on top of these excellent open-source projects:

| Project | What it provides |
| --- | --- |
| [Vite](https://vite.dev/) | Modern frontend development and build tooling |
| [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) | Userscript build, metadata generation, and dev workflow |
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
| `pnpm docs:dev` | Start the documentation site |
| `pnpm docs:build` | Build the documentation site |
| `pnpm lint:fix` | Run Biome checks and fixes |

## License

[MIT](./LICENSE)
