# @makoojs/vue

`@makoojs/vue` is Makoo's Vue mount adapter. It connects Vue components to the `@makoojs/core` adapter protocol, allowing the Makoo runtime to create Vue apps after target DOM nodes appear, mount components, and unmount them correctly when tasks are destroyed or reset.

## Use Cases

- Inject Vue components in a Makoo project.
- Let the `@makoojs/core` runtime recognize and mount Vue artifacts.
- Register the Vue adapter manually when using the core runtime directly.
- Read the Makoo task context `makoo` inside Vue components.
- Register shared plugins for Vue apps created by Makoo.

## Installation

```bash
# npm install @makoojs/vue
# yarn add @makoojs/vue
pnpm add @makoojs/vue
```

`@makoojs/vue` depends on `@makoojs/core` and declares `vue` as a peer dependency, so make sure `vue` is installed before using this package.

## Makoo Context In Vue Components

The Vue adapter passes `makoo` to the root component as props. Components can use it to read the current task ID, target selector, logger, or control the current task lifecycle.

```vue
<script setup lang="ts">
import type { VueMountProps } from '@makoojs/vue';

const props = defineProps<VueMountProps>();

function handleClick() {
	props.makoo.getLogger().info(`clicked ${props.makoo.taskId}`);
}
</script>

<template>
	<button type="button" @click="handleClick">Makoo Panel</button>
</template>
```

`makoo` comes from `@makoojs/core`'s `MakooContext`. Common capabilities include:

| Capability | Description |
| --- | --- |
| `taskId` | Current injection task ID |
| `injectAt` | Target selector for the current task |
| `enableAlive()` / `disableAlive()` | Control alive reinjection for the current task |
| `reset()` / `destroy()` | Reset or destroy the current task |
| `on()` / `onTask()` | Listen to lifecycle observation events |
| `getLogger()` | Get the current runtime logger |

## Usage With @makoojs/core

Pass the Vue adapter to `createMakoo()`, then declare Vue component tasks with `inject()`.

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const makoo = createMakoo({
	defaults: {
		alive: true,
		scope: 'local',
		timeout: 5000
	},
	adapters: [createVueAdapter()]
});

makoo.start([
	inject({
		id: 'panel',
		injectAt: '#app',
		artifact: Panel
	})
]);
```

The adapter returned by `createVueAdapter()` will:

- Create a Vue app with `createApp(artifact, { makoo })`.
- Apply shared plugins registered through `VuePlugin`.
- Mount the component with `app.mount(mountPoint)`.
- Call `app.unmount()` during unmount.
- Wrap mount/unmount failures as `VueAdapterError`.

## Register Vue Plugins

`VuePlugin` registers shared plugins for every Vue app created by Makoo, such as router, i18n, or UI library plugins.

Register shared Vue plugins before starting the Makoo runtime:

```ts
import { VuePlugin } from '@makoojs/vue';
import router from './router';
import i18n from './i18n';

VuePlugin.use(router);
VuePlugin.usePlugins(i18n);
```

You can also register multiple plugins at once:

```ts
VuePlugin.usePlugins(router, i18n);
```

For example, with Pinia:

```ts
import { VuePlugin } from '@makoojs/vue';
import { createPinia } from 'pinia';

const pinia = createPinia();

VuePlugin.usePlugins(pinia);
```

`VuePlugin` deduplicates the same plugin instance. In tests or special runtimes, call `VuePlugin.clear()` to remove registered plugins.

Import `VuePlugin` from `@makoojs/vue` so registration and mounting use the same plugin collection.

## Type Exports

`@makoojs/vue` exports these commonly used types:

| Type | Description |
| --- | --- |
| `VueMountProps` | Props received by the Vue root component, including `makoo` |
| `VueMountArtifact` | Vue artifact type recognized by Makoo |
| `VueMountAdapter` | Vue adapter type |
| `VueMountHandle` | Vue app handle type |
| `VueMountInstance` | Vue component instance type |

It also exports:

- `createVueAdapter`
- `VuePlugin`
- `VueAdapterError`

See the Vue API documentation for complete interface details.

## Relationship With Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/vue` | Vue mount adapter and Vue plugin registration |
| `@makoojs/core` | Provides the runtime API, adapter protocol, and Makoo runtime context |
| `@makoojs/cli` | Provides development and build capabilities for Makoo projects |

`@makoojs/vue` works with the injection runtime provided by `@makoojs/core`.
