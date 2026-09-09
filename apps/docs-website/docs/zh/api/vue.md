# Vue API

## API 索引

- [`createVueAdapter()`](#createvueadapter)：创建 Vue 挂载 adapter
- [`VuePlugin`](#vueplugin)：管理挂载到 Vue app 的插件
- [`VueAdapterError`](#vueadaptererror)：Vue 挂载错误
- [TypeScript 类型](#typescript-类型)：Vue adapter 的公开类型

## `createVueAdapter()`

创建用于挂载 Vue 组件的 Makoo adapter。

### 类型 {#type}

```ts
function createVueAdapter(): VueMountAdapter;
```

### 返回值 {#returns}

返回一个用于 Vue 组件的 Makoo 可解析挂载 adapter。

### 说明 {#details}

adapter 使用 `createApp(artifact, { makoo })` 创建 Vue app，依次安装 `VuePlugin` 中注册的插件，然后把 app 挂载到任务的 `mountPoint`。任务卸载时调用 `app.unmount()`。

挂载或卸载失败时抛出 `VueAdapterError`。

### 示例 {#example}

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const makoo = createMakoo({
	adapters: [createVueAdapter()]
});

makoo.start([
	inject({ injectAt: '#app', artifact: Panel })
]);
```

## `VuePlugin`

在 `start()` 前注册 Vue 插件，后续挂载的每个 Vue app 都会安装这些插件。

### 类型 {#type-1}

```ts
const VuePlugin: {
	getPlugins(): Plugin[];
	use<T extends Plugin>(plugin: T): void;
	usePlugins(...plugins: Plugin[]): void;
	clear(): void;
};
```

### 方法 {#methods}

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `getPlugins()` | `Plugin[]` | 返回当前插件列表的副本 |
| `use(plugin)` | `void` | 注册一个插件；同一个插件实例只保留一次 |
| `usePlugins(...plugins)` | `void` | 注册多个插件 |
| `clear()` | `void` | 清空全部插件 |

### 示例 {#example-1}

```ts
import { createPinia } from 'pinia';
import { VuePlugin } from '@makoojs/vue';

VuePlugin.use(createPinia());
```

## `VueAdapterError`

Vue adapter 挂载或卸载失败时使用的错误类，继承自 `AdapterError`。

### 类型 {#type-2}

```ts
class VueAdapterError extends AdapterError {
	constructor(
		message: string,
		issues?: MakooIssue[],
		code?: string,
		cause?: Error
	);
}
```

`code` 省略时使用 `ErrorCode.ADAPTER_MOUNT_FAIL`。

## TypeScript 类型

### `VueMountAdapter`

```ts
type VueMountAdapter = ResolvableMountAdapter<
	VueMountArtifact,
	VueMountHandle,
	VueMountInstance
>;
```

### `VueMountProps`

Vue 根组件接收的 props。

```ts
type VueMountProps = {
	makoo: MakooContext;
};
```

### `VueMountArtifact`

```ts
type VueMountArtifact = Component;
```

### `VueMountHandle`

```ts
type VueMountHandle = App<Element>;
```

### `VueMountInstance`

```ts
type VueMountInstance = ComponentPublicInstance;
```

组件示例及 `makoo` prop 的接收方式见[组件注入](../docs/injection.md)。Context 的完整方法见 [MakooContext](./adapters.md#makoocontext)。
