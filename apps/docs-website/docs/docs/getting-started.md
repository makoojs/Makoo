# Getting Started

This guide walks through creating a Makoo project, starting the dev server, and editing the
first injection module. By the end, you will have a userscript project that mounts a Vue or
React component into a matching page.

## Create A Project

Run the scaffold command:

```bash
pnpm dlx @makoojs/create-makoo
```

The scaffold will ask for the project name, userscript metadata, match URL, language
variant, and framework. The match URL becomes the userscript `@match` rule, so use the page
where you want to test the first injection.

For example:

```txt
Project name: makoo-project
Userscript name: makoo-project
Version: 0.0.1
Namespace: npm/makoo
Match URL(s): https://example.com/*
Variant: TypeScript
Framework: Vue
```

## Project Structure

A new Vue project usually looks like this:

```txt
.
├─ assets
│  ├─ makoo-icon.png
│  └─ vue.svg
├─ .gitignore
├─ env.d.ts
├─ package.json
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ src
   ├─ main.ts
   └─ injections
      └─ hello-world
         └─ App.vue
```

A React project uses the same shape, with `App.tsx` and a module stylesheet:

```txt
.
├─ assets
│  ├─ makoo-icon.png
│  └─ react.svg
├─ .gitignore
├─ env.d.ts
├─ package.json
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ src
   ├─ main.ts
   └─ injections
      └─ hello-world
         ├─ App.tsx
         └─ style.css
```

The generated template uses `createMakoo()` and `inject()` to declare tasks and start the runtime.
The example keeps its feature code under `src/injections/`.

## Configure The Userscript

The generated `vite.config.ts` contains the Makoo plugin:

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
				name: 'makoo-project',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					icon: 'https://vitejs.dev/logo.svg',
					namespace: 'npm/makoo',
					match: ['https://example.com/*']
				},
				build: {
					externalGlobals: {
						vue: cdn.jsdelivr('Vue', 'dist/vue.global.min.js')
					}
				}
			}
		})
	]
});
```

The `app` field provides Makoo-level project metadata. Makoo applies defaults and normalizes
the supported `monkey` options before passing them to `vite-plugin-monkey`, which generates
metadata such as `@name`, `@namespace`, and `@match`.

During development, choose a `match` pattern that includes the page you are testing. If the
userscript manager does not run the script on that page, Makoo cannot register any
injection modules there.

## Define The First Injection

The generated application code registers a single `hello-world` task:

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './injections/hello-world/App.vue';

const tasks = createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({ id: 'hello-world', injectAt: 'body', artifact: App })
]);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

This task declaration contains the following information:

| Field | Meaning |
| --- | --- |
| `id` | Task id; the example value is `hello-world` |
| `injectAt` | CSS selector for the target node |
| `artifact` | Imported component |

When the target node appears, Makoo creates a mount point inside it and the adapter mounts the
component into that mount point. In the scaffolded project, `injectAt: 'body'` makes the demo
easy to see on almost any matching page.

## Change The Target

To mount into a more specific part of a page, change `injectAt`:

```ts
inject({ id: 'toolbar', injectAt: '#toolbar', artifact: Toolbar });
```

In this example, the matching component lives here:

```txt
src/injections
└─ toolbar
   └─ App.vue
```

For React, import `createReactAdapter()` and the React component:

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Toolbar from './injections/toolbar/App.tsx';

createMakoo({ adapters: [createReactAdapter()] }).start([
	inject({ id: 'toolbar', injectAt: '#toolbar', artifact: Toolbar })
]);
```

## Test In The Browser

Start the dev server:

```bash
pnpm dev
```

Open the dev userscript URL printed by the command, install it in your userscript manager,
and then open a page that matches your `monkey.userscript.match` rule. The generated
`hello-world` component should appear on the page.

Changing the userscript `match` rule may require reinstalling or refreshing the development
userscript in your script manager.

## Next Steps

Continue with [Core Concepts](./concepts.md) to understand how the runtime, tasks, modules,
and adapters fit together. The Core API documents task options such as `alive`, `timeout`,
`scope`, listeners, and lifecycle hooks.
