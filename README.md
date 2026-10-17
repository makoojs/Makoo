<p align="center">
  <img width="180" src="./apps/docs-website/docs/public/makoo-icon.svg" alt="Makoo">
</p>

<h1 align="center">Makoo</h1>

<p align="center"><em>A framework for building userscripts with Vue or React</em></p>

<p align="center">
  <a href="https://github.com/makoojs/Makoo/"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/makoojs/Makoo?style=flat-square"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20.19%2B%20%7C%2022.12%2B-3c873a?style=flat-square">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://makoojs.github.io/Makoo/">Docs</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#when-to-use-makoo">When to Use</a> •
  <a href="./README.CN.md">中文</a>
</p>

---

Makoo is a userscript development framework for Tampermonkey, Violentmonkey, and ScriptCat. You write components in Vue or React and declare where they mount on the page and which page events they listen to; Makoo takes care of waiting for elements to appear, mounting components, recovering after nodes are replaced, and cleaning up when a feature stops. The dev server, userscript metadata, and builds are provided by [Vite](https://vite.dev/) and [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).

## Features

- **Component-driven development**: Build the interfaces injected into web pages with Vue or React.
- **Declarative injection**: Declare mount positions and attached listeners; a component and the page events it depends on start and stop together.
- **Handles dynamic pages**: Waits for asynchronously loaded nodes, and remounts automatically after the site replaces a node.
- **Complete cleanup**: Unmounts components and unbinds events on stop or removal, and reports cleanup failures explicitly.
- **Complete toolchain**: Scaffolding, hot updates, injection status in the terminal, and a single command to build the `.user.js`.

## When to Use Makoo

> [!IMPORTANT]
> Makoo is not meant for simple scripts. If your script only changes a button, hides an element, or injects a block of styles, plain userscript code is often enough.

Makoo becomes useful once a script starts to behave like a small frontend application:

- You need to build interfaces with Vue or React to modify existing web pages
- There are multiple components or feature modules on the same page
- Target nodes are removed and recreated by the site, and components and listeners need to recover with them
- The codebase is growing and needs a clear structure, configuration, and development workflow

## Quick Start

Have pnpm ready and a script manager installed in your browser, then create a project:

```sh
pnpm dlx @makoojs/create-makoo
cd makoo-project
pnpm dev
```

Open the address printed in the terminal in your browser, install the development script, then visit the target page you set, and you'll see the example component.

For an existing Vite project, see [Add Makoo to an Existing Project](https://makoojs.github.io/Makoo/docs/installation).

## Usage

### Declare a Component

In the entry file, create a Core instance, register a framework adapter, then declare the component to mount:

```ts
// src/main.ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());

core.apply([
  inject({
    // injection name, unique within the same instance
    name: 'panel',
    // CSS selector of the mount target; waits if the element appears later
    injectAt: 'body',
    adapter: 'vue',
    component: Panel
  })
]);
```

### Control the Injection from the Component

A component can read its own status and stop itself:

```vue
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const status = makoo.status;
</script>

<template>
  <aside>
    <p>Status: {{ status }}</p>
    <button @click="makoo.stop()">Close</button>
  </aside>
</template>
```

For React, page event listeners, and recovery after node replacement, see the [docs](https://makoojs.github.io/Makoo/).

## Documentation

Start with the [Quick Start](https://makoojs.github.io/Makoo/docs/getting-started) and [Tutorial: A Toggleable Tool Panel](https://makoojs.github.io/Makoo/docs/tutorial); the full guides and API reference are on the [docs site](https://makoojs.github.io/Makoo/).

## Acknowledgements

Makoo is built on [Vite](https://vite.dev/), [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey), [Vue](https://vuejs.org/), and [React](https://react.dev/). Thanks to these projects.
