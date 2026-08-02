# Vue API

## API 索引

- [`createVueAdapter()`](#createvueadapter)：创建 Vue 挂载 adapter
- [`VuePlugin`](#vueplugin)：管理挂载到 Vue app 的插件
- [`VueAdapterError`](#vueadaptererror)：Vue 挂载错误
- [TypeScript 类型](#typescript-类型)：Vue adapter 的公开类型

## `createVueAdapter()`

创建用于挂载 Vue 组件的 Makoo adapter。

### Type

```ts
function createVueAdapter(): VueMountAdapter;
```

### Returns

返回 `VueMountAdapter`。

### Details

adapter 使用 `createApp(artifact, { makoo })` 创建 Vue app，依次安装 `VuePlugin` 中注册的插件，然后把 app 挂载到任务的 `mountPoint`。任务卸载时调用 `app.unmount()`。

挂载或卸载失败时抛出 `VueAdapterError`。

### Example

```ts
const makoo = createMakoo({
	adapters: [createVueAdapter()]
});

makoo.start([
	inject({ injectAt: '#app', artifact: Panel })
]);
```

## `VuePlugin`

保存 `createVueAdapter()` 创建 Vue app 时需要安装的插件。

### Type

```ts
const VuePlugin: {
	getPlugins(): Plugin[];
	use<T extends Plugin>(plugin: T): void;
	usePlugins(...plugins: Plugin[]): void;
	clear(): void;
};
```

### Methods

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `getPlugins()` | `Plugin[]` | 返回当前插件列表的副本 |
| `use(plugin)` | `void` | 注册一个插件；同一个插件实例只保留一次 |
| `usePlugins(...plugins)` | `void` | 注册多个插件 |
| `clear()` | `void` | 清空全部插件 |

### Example

```ts
VuePlugin.use(router);
VuePlugin.usePlugins(pinia, i18n);
```

## `VueAdapterError`

Vue adapter 挂载或卸载失败时使用的错误类，继承自 `AdapterError`。

### Type

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
