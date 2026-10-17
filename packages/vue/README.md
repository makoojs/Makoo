# @makoojs/vue

<p>
  <a href="https://www.npmjs.com/package/@makoojs/vue"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/vue?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/api/vue">API Reference</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/vue/README.CN.md">中文</a>
</p>

The Vue adapter for Makoo. It lets [`@makoojs/core`](https://www.npmjs.com/package/@makoojs/core) mount Vue components onto web pages, and provides APIs for reading status and controlling the injection from inside components.

Each mount creates a separate Vue app. Requires Vue 3.3 or later.

## Installation

```sh
pnpm add @makoojs/vue @makoojs/core vue
```

> [!TIP]
> Vue projects created with `pnpm dlx @makoojs/create-makoo` already include it; no separate installation is needed.

## Usage

### Register the Adapter

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());

core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'vue', component: Panel })
]);
```

### Read Status and Control the Injection in a Component

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

### Install Vue Plugins

Register plugins such as Pinia or Vue Router through `VuePlugin`, and they are installed automatically on every mount:

```ts
import { createPinia } from 'pinia';
import { VuePlugin } from '@makoojs/vue';

VuePlugin.use(createPinia());
```

Register them before `core.apply()`; components that are already mounted don't get plugins registered later.

## Documentation

- [Vue API](https://makoojs.github.io/Makoo/api/vue): `createVueAdapter()`, `useMakooComponent()`, and `VuePlugin`.
- [Mount Components](https://makoojs.github.io/Makoo/docs/injection): choosing a mount position, passing props, and common patterns.
