# Quick Start

In this tutorial, you will create a Makoo project, install the development script in your browser, and see your first component appear on a page. It takes about 10 minutes.

## 1. Prepare Your Environment

- Node.js 20.x at 20.19 or later, or 22.12 or later; and pnpm.
- A script manager installed and enabled in your browser, such as Tampermonkey, Violentmonkey, or ScriptCat.
- A page to test on. This tutorial uses `https://example.com/`.

## 2. Create the Project

```sh
pnpm dlx @makoojs/create-makoo
```

Answer the prompts in order:

| Prompt | Value for this tutorial |
| --- | --- |
| Project name | `makoo-project` |
| Userscript name | Keep the default |
| Version | Keep the default `0.0.1` |
| Namespace | Keep the default `npm/makoo` |
| Match URL(s) | `https://example.com/*` |
| Variant | TypeScript |
| Framework | Vue or React, either one |

Confirm the final `Install with pnpm and start now?`, and the scaffold installs dependencies (this step does not start the development server). Then enter the project directory and start the development server:

```sh
cd makoo-project
pnpm dev
```

If you did not install dependencies while creating the project, run `pnpm install` first.

## 3. Install the Development Script

The terminal prints a local address. Open it in your browser; the script manager shows an install page. Confirm the installation.

Then visit `https://example.com/`. A Makoo card with a counter button appears in the middle of the page.

The install page and the target page are two different places: the former is only for installing the script, and the latter is where the component runs. Keep `pnpm dev` running during development.

If you don't see the card, first check that the URL in the address bar matches `https://example.com/*`, then look at the browser console. For more troubleshooting steps, see [Troubleshooting](./troubleshooting.md).

## 4. Edit the Component

Open `src/injections/hello-world/App.vue` (`App.tsx` for React projects), change the title `Makoo` to `Hello Makoo`, and save.

Go back to the target page and the title updates. Vue components update in place and keep the count; React components usually update in place too.

## 5. Understand the Entry

Open `src/main.ts`:

::: code-group
```ts [Vue]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './injections/hello-world/App.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({
    name: 'hello-world',
    injectAt: 'body',
    adapter: 'vue',
    component: App,
  }),
]);
```
```ts [React]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import App from './injections/hello-world/App.tsx';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({
    name: 'hello-world',
    injectAt: 'body',
    adapter: 'react',
    component: App,
  }),
]);
```
:::

These four lines do all the work:

1. `createMakoo()` creates a Core instance.
2. `useAdapter()` registers the framework adapter so the instance can mount Vue or React components.
3. `inject()` declares a component named `hello-world`: mount it to `body` using `App`.
4. `apply()` hands the declaration to the instance. The instance finds `body`, creates a container, and mounts the component into it.

## What You Accomplished

You created a project, installed the development script, ran a component on a real page, and saw your changes take effect live.

## Next Steps

- [Tutorial: A Toggleable Tool Panel](./tutorial.md): add a close button and a listener on a page element to the component.
- [Core Concepts](./concepts.md): understand how instances, declarations, and injections relate.
- [Build and Preview](./build.md): produce a distributable `.user.js`.
