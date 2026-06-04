# @makoo/vue

`@makoo/vue` is Makoo's Vue mount adapter. It connects Vue components to the `@makoo/core` adapter protocol, allowing `Injector` to create Vue apps after target DOM nodes appear, mount components, and unmount them correctly when tasks are destroyed or reset.

Most Makoo projects use this package through `@makoo/cli`: when a manifest module is recognized as Vue, the CLI imports the Vue adapter in the generated virtual entry. You only need to call `createVueAdapter()` explicitly when wiring a runtime manually with `@makoo/core`.

## Use Cases

- Inject Vue components in a Makoo project.
- Let the `@makoo/core` `Injector` recognize and mount Vue artifacts.
- Register the Vue adapter manually when using the core runtime directly.
- Read the Makoo task context `makoo` inside Vue components.
- Register shared plugins for Vue apps created by Makoo.

## Installation

```bash
// npm install @makoo/vue
// yarn add @makoo/vue
pnpm add @makoo/vue
```

`@makoo/vue` depends on `@makoo/core` and declares `vue` as a peer dependency, so make sure `vue` is installed before using this package.

## Usage In CLI Projects

In most cases, you only need to declare a Vue component in the manifest.

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/App.vue',
			framework: 'Vue'
		}
	}
});
```

If `framework` is omitted or set to `auto`, Makoo infers Vue from the `.vue` extension.

## Makoo Context In Vue Components

The Vue adapter passes `makoo` to the root component as props. Components can use it to read the current task ID, target selector, logger, or control the current task lifecycle.

```vue
<script setup lang="ts">
import type { VueMountProps } from '@makoo/vue';

const props = defineProps<VueMountProps>();

function handleClick() {
	props.makoo.getLogger().info(`clicked ${props.makoo.taskId}`);
}
</script>

<template>
	<button type="button" @click="handleClick">Makoo Panel</button>
</template>
```

`makoo` comes from `@makoo/core`'s `MakooContext`. Common capabilities include:

| Capability | Description |
| --- | --- |
| `taskId` | Current injection task ID |
| `injectAt` | Target selector for the current task |
| `enableAlive()` / `disableAlive()` | Control alive reinjection for the current task |
| `reset()` / `destroy()` | Reset or destroy the current task |
| `on()` / `onTask()` | Listen to lifecycle observation events |
| `getLogger()` | Get the current injector logger |

## Direct Usage With @makoo/core

If you are not using `@makoo/cli`, register the Vue adapter manually on `Injector`.

```ts
import { Injector } from '@makoo/core';
import { createVueAdapter } from '@makoo/vue';
import Panel from './Panel.vue';

const injector = new Injector({
	alive: true,
	scope: 'local',
	timeout: 5000
}).applyAdapter(createVueAdapter());

injector.register('#app', Panel);
injector.run();
```

The adapter returned by `createVueAdapter()` will:

- Create a Vue app with `createApp(artifact, { makoo })`.
- Apply shared plugins registered through `VuePlugin`.
- Mount the component with `app.mount(mountPoint)`.
- Call `app.unmount()` during unmount.
- Wrap mount/unmount failures as `VueAdapterError`.

## Register Vue Plugins

`VuePlugin` registers shared plugins for every Vue app created by Makoo, such as router, i18n, or UI library plugins.

In CLI projects, put plugin registration in the setup file referenced by `runtime.setup`. The setup file enters Makoo's generated virtual entry first. Later, when the Vue adapter mounts each Vue component, it reads these plugins and calls `app.use(plugin)` for each one.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { makoo } from '@makoo/cli';

export default defineConfig({
	plugins: [
		...makoo({
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			runtime: {
				setup: './injections/vue-setup.ts'
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
import { VuePlugin } from '@makoo/vue';
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
// injections/vue-setup.ts
import { VuePlugin } from '@makoo/vue';
import { createPinia } from 'pinia';

const pinia = createPinia();

VuePlugin.usePlugins(pinia);
```

`VuePlugin` deduplicates the same plugin instance. In tests or special runtimes, call `VuePlugin.clear()` to remove registered plugins.

The setup file should import `VuePlugin` from `@makoo/vue`, not from a source path or alias. Otherwise, the setup file may register plugins on one `VuePlugin` instance while the Vue adapter reads from another instance, so the plugins will not be installed on the Vue app that mounts your component.

## Type Exports

`@makoo/vue` exports these commonly used types:

| Type | Description |
| --- | --- |
| `VueMountProps` | Props received by the Vue root component, including `makoo` |
| `VueMountArtifact` | Vue artifact type recognized by Makoo |
| `VueMountHandle` | Vue app handle type |
| `VueMountInstance` | Vue component instance type |

It also exports:

- `createVueAdapter`
- `VuePlugin`
- `VueAdapterError`

The complete API reference will live in a separate documentation site later.

## Relationship With Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoo/vue` | Vue mount adapter and Vue plugin registration helper |
| `@makoo/core` | Provides `Injector`, the adapter protocol, and Makoo runtime context |
| `@makoo/cli` | Scans manifests, generates the virtual entry, and imports the Vue adapter when needed |

`@makoo/vue` is not a complete runtime by itself. It works with `@makoo/core`'s injection scheduler, or with runtime code generated automatically by `@makoo/cli`.
