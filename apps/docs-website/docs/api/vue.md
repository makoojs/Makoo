# @makoojs/vue

`@makoojs/vue` provides the Vue adapter that lets Makoo mount Vue components in injection tasks. It also provides a small global Vue plugin registry for installing plugins into every injected Vue app.

## Exports

```ts
import { createVueAdapter, VuePlugin, VueAdapterError } from '@makoojs/vue';
```

Types:

```ts
import type {
	VueMountArtifact,
	VueMountHandle,
	VueMountInstance,
	VueMountProps
} from '@makoojs/vue';
```

## createVueAdapter()

Creates the Vue mount adapter.

```ts
import { Injector } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const injector = new Injector();

injector.applyAdapter(createVueAdapter());
injector.register('body', Panel);
injector.run();
```

Signature:

```ts
function createVueAdapter(): VueMountAdapter;
```

The adapter:

1. Checks whether an artifact is a Vue component.
2. Creates a Vue app with `createApp(artifact, { makoo })`.
3. Installs all plugins registered in `VuePlugin`.
4. Mounts with `app.mount(mountPoint)`.
5. Calls `app.unmount()` on reset, destroy, or remount.

## Component Props

Vue components receive a `makoo` prop:

```vue
<script setup lang="ts">
import type { VueMountProps } from '@makoojs/vue';

defineProps<VueMountProps>();
</script>

<template>
	<button @click="makoo.destroy()">Close</button>
</template>
```

Type:

```ts
type VueMountProps = {
	makoo: MakooContext;
};
```

`MakooContext` comes from `@makoojs/core` and contains task id, target selector, reset/destroy methods, hooks, logger access, and listener controls.

## VuePlugin

`VuePlugin` is a module-level plugin registry. When `createVueAdapter()` mounts a component, it installs every registered plugin into the newly created Vue app.

```ts
import { VuePlugin } from '@makoojs/vue';
import pinia from './pinia';

VuePlugin.use(pinia);
```

API:

| Method | Description |
| --- | --- |
| `VuePlugin.use(plugin)` | Register one Vue plugin; duplicate plugins are ignored |
| `VuePlugin.usePlugins(...plugins)` | Register multiple plugins |
| `VuePlugin.getPlugins()` | Return a copy of the current plugin list |
| `VuePlugin.clear()` | Clear all registered plugins |

Example:

```ts
import { VuePlugin } from '@makoojs/vue';
import router from './router';
import pinia from './pinia';

VuePlugin.usePlugins(router, pinia);
```

If you use `VuePlugin` in tests, call `VuePlugin.clear()` after each case to avoid leaking plugin state.

## VueMountArtifact

```ts
type VueMountArtifact = Component;
```

Regular `.vue` single-file components, components returned by `defineComponent()`, and other Vue-recognizable component objects can be registered as artifacts.

```ts
injector.register('#panel', Panel);
```

## VueMountHandle and VueMountInstance

```ts
type VueMountHandle = App<Element>;
type VueMountInstance = ComponentPublicInstance;
```

The adapter's `mount()` returns:

```ts
{
	handle: app,
	instance
}
```

`handle` is used for unmounting. `instance` is the mounted Vue component instance.

## Usage in Manifest

When using Vue components through `@makoojs/cli`, set `framework: 'Vue'` explicitly:

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

Makoo can infer Vue from `.vue` files, but being explicit keeps the manifest easier to read.

## VueAdapterError

The Vue adapter throws `VueAdapterError` when mount or unmount fails.

```ts
import { VueAdapterError } from '@makoojs/vue';

try {
	injector.run();
} catch (error) {
	if (error instanceof VueAdapterError) {
		console.error(error.code, error.issues);
	}
}
```

`VueAdapterError` extends `AdapterError`, so it can also be handled through the base error types from `@makoojs/core`.
