# Vue API

The APIs on this page are imported from `@makoojs/vue`.

## `createVueAdapter()`

Creates a component adapter named `'vue'`.

```ts
function createVueAdapter(): VueMountAdapter;
```

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

On each mount, the adapter calls `createApp(component, props)` to create a separate Vue app, installs the plugins registered in [`VuePlugin`](#vueplugin), and then mounts it into the component container. On unmount, it calls `app.unmount()`.

The `props` in the declaration are passed as the root component's props, which the component receives with `defineProps()`.

## `useMakooComponent()`

In a Vue component mounted by Makoo, gets the command and status of the owning component.

```ts
function useMakooComponent(): VueMakooComponent;
```

```vue
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const search = makoo.attachedListener('search-submit');
</script>

<template>
  <p>Search box: {{ search }}</p>
  <button @click="makoo.remove()">Close</button>
</template>
```

### Return Value

```ts
type VueMakooComponent = ComponentCommand & {
  readonly lastError: MakooError | undefined;
  readonly status: Readonly<Ref<ComponentStatus>>;
  attachedListener(name: string): Readonly<Ref<ListenerStatus>>;
  listener(name: string): ListenerCommand & {
    readonly lastError: MakooError | undefined;
    readonly status: Readonly<Ref<ListenerStatus>>;
  };
};
```

| Member | Description |
| --- | --- |
| `name`, `start()`, `stop()`, `remove()` | The owning component's [command handle](./status.md#command-handle), flattened from `core.injection(name).command` |
| `status` | A read-only ref of the component status |
| `lastError` | Reads the status handle's `lastError`; not reactive |
| `attachedListener(name)` | A read-only ref of an attached listener's status; throws `MAKOO_LISTENER_NOT_FOUND` if the name doesn't exist |
| `listener(name)` | Flat command methods and status ref for a standalone listener in the same instance (wraps `core.listener(name)`) |

Refs such as `status` live on a plain object, and templates only auto-unwrap top-level variables. Assign them to top-level constants first (like `search` in the example above) instead of writing `makoo.status` directly in the template.

`setup` and `onMounted` run during Vue's mount, when the component status is still `waiting` and attached listeners are still `idle`. Only after mounting returns does Core start the attached listeners and set the status to `mounted`, and the refs update accordingly. Don't branch on status read synchronously in `setup`.

### Subscription and Release

- Calling `useMakooComponent()` creates subscriptions for the component status and all attached listeners.
- `listener(name)` subscribes to that standalone listener on first call; repeated calls with the same name reuse the same ref. After that standalone listener is removed and `apply()`d again, call `listener(name)` once more: the ref switches to the new listener, while `start` / `stop` / `remove` on the old return value still point to the old listener.
- Subscriptions are released automatically when the component unmounts or its effect scope ends. Releasing subscriptions doesn't stop standalone listeners.
- `lastError` doesn't trigger updates. When the component fails, its status becomes `failed`, so reading `status` in the template as well is enough to re-render. When a standalone listener's callback fails, its status stays `bound` and only `lastError` is written, so the UI won't update because of it.

### Where to Call It

`useMakooComponent()` must be called synchronously inside a Vue app mounted by Makoo, in a component's `setup` or an effect scope. Child components can call it too, and get the same owning component.

In a component mounted by [`injectEach()`](./declarations.md#injecteach), it returns the command and status of that Child Injection only: the command is a `ChildCommand` (`{ name, stop }`, no `start`/`remove`), and `stop()` unmounts this one component while the other matches stay mounted. A Child has no attached listeners, so `attachedListener(name)` always throws `MAKOO_LISTENER_NOT_FOUND`.

| Situation | Error code |
| --- | --- |
| Makoo's injection context isn't available: not in an app mounted by Makoo, or not called synchronously in `setup` (for example, in an event handler or `setTimeout`) | `MAKOO_VUE_HOOK_OUTSIDE_COMPONENT` |
| The injection context is available but there is no effect scope, for example when called in a plugin through `app.runWithContext()` | `MAKOO_VUE_HOOK_OUTSIDE_SCOPE` |
| `listener(name)` can't find a standalone listener | `MAKOO_INJECTION_NOT_FOUND` |

## `VuePlugin`

Registers plugins to install into every Makoo Vue app, such as Pinia, Vue Router, or a component library.

```ts
const VuePlugin: {
  use<T extends Plugin>(plugin: T): void;
  usePlugins(...plugins: Plugin[]): void;
  getPlugins(): Plugin[];
  clear(): void;
};
```

| Method | Description |
| --- | --- |
| `use(plugin)` | Registers a plugin; the same plugin instance is registered only once |
| `usePlugins(...plugins)` | Registers multiple plugins |
| `getPlugins()` | Returns a copy of the registered plugins |
| `clear()` | Clears the registrations |

```ts
import { createPinia } from 'pinia';
import { VuePlugin } from '@makoojs/vue';

VuePlugin.use(createPinia());
```

On each mount, the current registrations are read and installed into the new app; already mounted apps don't get plugins registered later, and `clear()` only affects later mounts too, so register plugins before `core.apply()` as a rule. `VuePlugin` is a module-level global registry that applies to all Core instances. When the same Pinia instance is shared by multiple apps, those components read and write the same store.

## `VueErrorCode`

| Constant | Value |
| --- | --- |
| `VUE_HOOK_OUTSIDE_COMPONENT` | `'MAKOO_VUE_HOOK_OUTSIDE_COMPONENT'` |
| `VUE_HOOK_OUTSIDE_SCOPE` | `'MAKOO_VUE_HOOK_OUTSIDE_SCOPE'` |
| `VUE_PARTIAL_MOUNT_UNCONFIRMED` | `'MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED'` |

When failure happens after `app.mount()` has started (for example, a child component's `setup` throws), Vue can't unmount the half-built component tree. The adapter releases the subscriptions it created and attaches `VUE_PARTIAL_MOUNT_UNCONFIRMED`. Core treats this failure as a cleanup failure: the injection is closed, later `start()` calls throw `MAKOO_INJECTION_CLOSED`, and only reloading the page helps. When an error is thrown during plugin installation (before `app.mount()`), the original error is reported directly as a mount failure, and the injection can be started again.

## Types

`VueMakooComponent` is the return type of `useMakooComponent()`; for its shape, see [Return Value](#return-value).

```ts

type VueMountComponent = Component;
type VueMountProps = Record<string, unknown>;
type VueMountHandle = App<Element>;
type VueMountAdapter = MountAdapter<VueMountComponent, VueMountProps, VueMountHandle>;
```
