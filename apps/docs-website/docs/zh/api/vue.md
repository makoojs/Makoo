# Vue API

本页 API 从 `@makoojs/vue` 导入。

## `createVueAdapter()`

创建名称为 `'vue'` 的组件适配器。

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

每次挂载时，适配器调用 `createApp(component, props)` 创建一个独立的 Vue app，安装 [`VuePlugin`](#vueplugin) 中登记的插件，再挂载到组件容器。卸载时调用 `app.unmount()`。

声明中的 `props` 作为根组件的 props 传入，组件用 `defineProps()` 接收。

## `useMakooComponent()`

在 Makoo 挂载的 Vue 组件中，取得所属组件的命令和状态。

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
  <p>搜索框：{{ search }}</p>
  <button @click="makoo.remove()">关闭</button>
</template>
```

### 返回值

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

| 成员 | 说明 |
| --- | --- |
| `name`、`start()`、`stop()`、`remove()` | 所属组件的[命令入口](./status.md#命令入口)，与 `core.injection(name).command` 是同一组方法 |
| `status` | 组件状态的只读 ref |
| `lastError` | 读取状态入口的 `lastError`，不是响应式的 |
| `attachedListener(name)` | 附属监听状态的只读 ref；名称不存在时抛出 `MAKOO_LISTENER_NOT_FOUND` |
| `listener(name)` | 同一实例中某个独立监听的命令和状态 ref |

`status` 等 ref 挂在普通对象上，模板只会自动解包顶层变量。请先赋给顶层常量（如上例的 `search`），不要在模板里直接写 `makoo.status`。

`setup` 和 `onMounted` 运行在 Vue 挂载过程中，此时组件状态仍是 `waiting`，附属监听仍是 `idle`。挂载返回后 Core 才启动附属监听并把状态设为 `mounted`，ref 随之更新。不要在 `setup` 中根据同步读到的状态做分支。

### 订阅与释放

- 调用 `useMakooComponent()` 时，会为组件状态和全部附属监听建立订阅。
- `listener(name)` 在首次调用时订阅该独立监听；对同一名称重复调用会复用同一个 ref。该独立监听被移除并重新 `apply()` 后，需要再调用一次 `listener(name)`：ref 会切换到新的监听，旧返回值上的 `start` / `stop` / `remove` 仍指向旧监听。
- 组件卸载或所在 effect scope 结束时，订阅自动释放。释放订阅不会停止独立监听。
- `lastError` 不会触发更新。组件出错时状态会变为 `failed`，在模板中同时读取 `status` 即可重新渲染。独立监听的回调出错时状态保持 `bound`，只写入 `lastError`，界面不会因此更新。

### 调用位置

`useMakooComponent()` 必须在 Makoo 挂载的 Vue app 内、组件 `setup` 或 effect scope 中同步调用。子组件也可以调用，取得的是同一个所属组件。

| 情况 | 错误码 |
| --- | --- |
| 取不到 Makoo 的注入上下文：不在 Makoo 挂载的 app 中，或不在 `setup` 中同步调用（例如在事件处理函数、`setTimeout` 里） | `MAKOO_VUE_HOOK_OUTSIDE_COMPONENT` |
| 能取到注入上下文，但没有 effect scope，例如在插件里通过 `app.runWithContext()` 调用 | `MAKOO_VUE_HOOK_OUTSIDE_SCOPE` |
| `listener(name)` 找不到独立监听 | `MAKOO_INJECTION_NOT_FOUND` |

## `VuePlugin`

登记要安装到每个 Makoo Vue app 的插件，例如 Pinia、Vue Router 或组件库。

```ts
const VuePlugin: {
  use<T extends Plugin>(plugin: T): void;
  usePlugins(...plugins: Plugin[]): void;
  getPlugins(): Plugin[];
  clear(): void;
};
```

| 方法 | 说明 |
| --- | --- |
| `use(plugin)` | 登记一个插件；同一插件实例只登记一次 |
| `usePlugins(...plugins)` | 登记多个插件 |
| `getPlugins()` | 返回已登记插件的副本 |
| `clear()` | 清空登记 |

```ts
import { createPinia } from 'pinia';
import { VuePlugin } from '@makoojs/vue';

VuePlugin.use(createPinia());
```

每次挂载时读取当前登记并安装到新的 app；已经挂载的 app 不会补装之后登记的插件，`clear()` 也只影响之后的挂载，因此通常在 `core.apply()` 之前登记。`VuePlugin` 是模块级的全局登记，对所有 Core 实例生效。同一个 Pinia 实例被多个 app 共享时，这些组件读写的是同一份 store。

## `VueErrorCode`

| 常量 | 值 |
| --- | --- |
| `VUE_HOOK_OUTSIDE_COMPONENT` | `'MAKOO_VUE_HOOK_OUTSIDE_COMPONENT'` |
| `VUE_HOOK_OUTSIDE_SCOPE` | `'MAKOO_VUE_HOOK_OUTSIDE_SCOPE'` |
| `VUE_PARTIAL_MOUNT_UNCONFIRMED` | `'MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED'` |

`app.mount()` 开始后失败（例如子组件 `setup` 抛错）时，Vue 无法卸载半截的组件树。适配器释放已建立的订阅，并附上 `VUE_PARTIAL_MOUNT_UNCONFIRMED`。Core 把这次失败当作清理失败处理：注入被关闭，之后 `start()` 抛出 `MAKOO_INJECTION_CLOSED`，只能刷新页面。插件安装阶段（`app.mount()` 之前）抛错时，原错误直接作为挂载失败报告，注入可以再次启动。

## 类型

`VueMakooComponent` 是 `useMakooComponent()` 的返回类型，形状见[返回值](#返回值)。

```ts

type VueMountComponent = Component;
type VueMountProps = Record<string, unknown>;
type VueMountHandle = App<Element>;
type VueMountAdapter = MountAdapter<VueMountComponent, VueMountProps, VueMountHandle>;
```
