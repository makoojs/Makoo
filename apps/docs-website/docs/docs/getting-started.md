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
│  ├─ makoo-icon-transparent.png
│  └─ vue.svg
├─ package.json
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   └─ hello-world
      └─ app.vue
```

A React project uses the same shape, with `app.tsx` and a module stylesheet:

```txt
.
├─ assets
│  ├─ makoo-icon-transparent.png
│  └─ react.svg
├─ package.json
├─ vite.config.ts
└─ injections
   ├─ manifest.ts
   └─ hello-world
      ├─ app.tsx
      └─ style.css
```

The important directory is `injections/`. Makoo scans this area, reads the manifest, and
generates the runtime entry that registers your modules.

## Configure The Userscript

The generated `vite.config.ts` contains the Makoo plugin:

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			app: {
				name: 'makoo-project',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					namespace: 'npm/makoo',
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

The `app` field provides Makoo-level project metadata. The `monkey.userscript` field is
passed to `vite-plugin-monkey` and becomes userscript metadata such as `@name`,
`@namespace`, and `@match`.

During development, choose a `match` pattern that includes the page you are testing. If the
userscript manager does not run the script on that page, Makoo cannot register any
injection modules there.

## Define The First Injection

The generated manifest registers a single `hello-world` module:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		'hello-world': {
			injectAt: 'body',
			component: './hello-world/app.vue'
		}
	}
});
```

Each entry describes one injection module:

| Field | Meaning |
| --- | --- |
| `hello-world` | Module name |
| `injectAt` | CSS selector for the target node |
| `component` | Component path relative to the manifest |

When the target node appears, Makoo mounts the component into that target. In the scaffolded
project, `injectAt: 'body'` makes the demo easy to see on almost any matching page.

## Change The Target

To mount into a more specific part of a page, change `injectAt`:

```ts
export default defineInjections({
	injections: {
		toolbar: {
			injectAt: '#toolbar',
			component: './toolbar/app.vue'
		}
	}
});
```

Then create the matching module directory:

```txt
injections
├─ manifest.ts
└─ toolbar
   └─ app.vue
```

For React, use `app.tsx` instead:

```ts
export default defineInjections({
	injections: {
		toolbar: {
			injectAt: '#toolbar',
			component: './toolbar/app.tsx'
		}
	}
});
```

Makoo can infer the framework from the component extension. You can still set
`framework: 'Vue'` or `framework: 'React'` explicitly when you want the manifest to be
clearer.

## Test In The Browser

Start the dev server:

```bash
pnpm dev
```

Open the dev userscript URL printed by the command, install it in your userscript manager,
and then open a page that matches your `monkey.userscript.match` rule. The generated
`hello-world` component should appear on the page.

While the dev server is running:

- editing a Vue or React component uses normal Vite HMR
- editing `injections/manifest.ts` triggers Makoo's structural update flow
- changing the userscript `match` rule may require reinstalling or refreshing the dev
  userscript in your script manager

## Next Steps

Continue with [Core Concepts](./concepts.md) to understand how injectors, modules,
manifests, and adapters fit together. Then use [Manifest Reference](./manifest.md) when you
need module-level options such as `match`, `alive`, `timeout`, `scope`, and lifecycle
`hooks`.
