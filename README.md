<p align="center">
  <img width="250" src="./apps/docs-website/docs/public/makoo-icon.png">
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

It focuses on waiting for target DOM nodes, mounting components, reinjecting after a host target is removed, and composing multiple injection tasks. [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) handles build output, userscript metadata, and installation. Makoo provides runtime composition and adapters for component injection.

## When To Use Makoo

Makoo is not meant for simple userscripts. If your script only changes a button, hides an element, or injects a small style block, plain userscript code is often enough.

Makoo is a better fit for userscripts that start behaving like small frontend applications:

- building injected UI with Vue or React to modify existing web pages
- multiple injection points or feature modules on the same page
- host target nodes that are removed and recreated, requiring component reinjection
- modules that need to be enabled by URL or page state
- growing codebases that need clear structure, configuration, and development workflow

Makoo becomes useful when lifecycle, module boundaries, and long-term maintenance start to matter.

## Table of Contents

- [When To Use Makoo](#when-to-use-makoo)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Project Structure](#project-structure)
- [Configuration Overview](#configuration-overview)
- [Runtime Composition](#runtime-composition)
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

A project includes Vite configuration, application code, and an example injection.

## Core Concepts

`createMakoo()` creates Makoo's runtime scheduler. It starts declared injection tasks, waits for target nodes, asks the matching adapter to mount components, and handles reinjection when needed.

`Injection Module` represents an independent injection feature or mount unit. It can include components, styles, and related application logic.

`Task` is a runtime declaration. `inject()` declares a component injection and `listen()` declares an event listener. The application composes these tasks and passes them to `makoo.start()`.

`Adapter` is the component mounting bridge. Makoo supports Vue and React through `@makoojs/vue` and `@makoojs/react`, and the adapter model can support other mountable artifacts later.

## Project Structure

Projects can organize injection-related code as needed. For example:

```txt
src/injections
├─ profile-card
│  ├─ App.vue
│  └─ style.css
└─ react-badge
   ├─ App.tsx
   └─ style.css
```

`createMakoo()`, `inject()`, and `listen()` provide runtime composition. Projects can organize the related code according to their own conventions.

## Configuration Overview

Makoo's Vite plugin config describes the build toolchain:

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

`app` is used to generate userscript metadata such as name, version, and description.

`entry` specifies the application file bundled by Vite. It can import Vue, React, components, stores, hooks, and other browser code directly.

Most `monkey` options are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) for userscript metadata, dev server behavior, and build behavior.

## Runtime Composition

`@makoojs/core` provides `createMakoo()`, `inject()`, and `listen()` for creating the runtime and declaring tasks. This example uses both Vue and React modules:

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import { createVueAdapter } from '@makoojs/vue';
import Header from './injections/header/App.vue';
import Badge from './injections/badge/App.tsx';

const makoo = createMakoo({
	adapters: [createVueAdapter(), createReactAdapter()],
	defaults: {
		alive: false,
		scope: 'local'
	}
});

makoo.start([
	inject({ id: 'header', injectAt: '#header', artifact: Header }),
	inject({
		id: 'badge',
		injectAt: 'body',
		artifact: Badge,
		options: { alive: true, timeout: 10_000 }
	})
]);
```

Common injection fields:

| Field | Description |
| --- | --- |
| `id` | Stable task id |
| `injectAt` | Target selector for injection |
| `artifact` | Component or other value mounted by an adapter |
| `options.alive` | Whether to wait for the same selector and reinject after the host target node is removed |
| `options.scope` | Removal observation scope used by alive mode, supports `local` and `global` |
| `options.timeout` | Timeout for waiting for the target node |
| `options.hooks` | Lifecycle hooks for the current task |
| `options.on` | Listener declaration owned by the component task |

`injectAt` must be a CSS selector; `document` and `window` are not supported injection targets.

### Standalone Listeners

`listen()` declares event tasks that are not owned by an injection module. They do not need a component directory or framework adapter:

```ts
import { listen } from '@makoojs/core';

const escapeClose = listen({
	id: 'escape-close',
	listenAt: 'body',
	type: 'keydown',
	capture: true,
	callback: (event) => {
		if (event instanceof KeyboardEvent && event.key === 'Escape') console.log('close');
	}
});
```

Listeners support `capture` and `activitySignal`. `capture` defaults to `false`; set it to `true` to listen during the DOM capture phase. `listenAt` must be a CSS selector; `document` and `window` are not supported listener targets.

## Recipes

### Enable a Module by URL

```ts
const isProfilePage = location.pathname.startsWith('/users/') &&
	location.pathname !== '/users/settings';

if (isProfilePage) {
	makoo.start([
		inject({ id: 'profile', injectAt: '#app', artifact: Profile })
	]);
}
```

### Use a Vue Module

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './injections/panel/App.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({ id: 'panel', injectAt: 'body', artifact: Panel })
]);
```

### Split Hooks

```ts
// src/hooks.ts
export const hooks = {
	'start:requested': () => {
		console.log('[makoo] start requested');
	}
};
```

```ts
// src/main.ts
import { hooks } from './hooks';
import { createMakoo, inject } from '@makoojs/core';
import App from './injections/hello-world/App.vue';

const makoo = createMakoo({ hooks });
makoo.start([
	inject({ id: 'hello-world', injectAt: 'body', artifact: App })
]);
```

### Reduce Bundle Size with `externalGlobals`

`monkey.build.externalGlobals` and `externalResource` are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey):

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';
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
				build: {
					externalGlobals: {
						vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js')
					}
				}
			}
		})
	]
});
```

### Use GM APIs

Makoo provides a stable [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM API import path through `@makoojs/cli/monkey`. Prefer capability-level imports so the final userscript only references the GM APIs it actually uses:

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

You can also use grouped imports. Prefer capability-level imports when you want the smallest generated `@grant` surface; `GMapi` is convenient for shared or exploratory code:

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
| `@makoojs/cli` | Vite and userscript integration, config resolution, and project commands |
| `@makoojs/create-makoo` | Project scaffold |

A typical project uses `@makoojs/cli` for Vite and userscript integration, `@makoojs/core` for task composition, and either `@makoojs/vue` or `@makoojs/react` for its component adapter.

## Special Thanks

Makoo is built on top of these excellent open-source projects:

| Project | What it provides |
| --- | --- |
| [Vite](https://vite.dev/) | Modern frontend development and build tooling |
| [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) | Userscript build, metadata generation, and dev workflow |
| [Vue](https://vuejs.org/) | Vue component ecosystem and runtime |
| [React](https://react.dev/) | React component ecosystem and runtime |
| [Vitest](https://vitest.dev/) | Test runner |

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
