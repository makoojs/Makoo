# Vue API Reference

## API Index

- [`createVueAdapter()`](#createvueadapter): creates the Vue mounting adapter
- [`VuePlugin`](#vueplugin): manages plugins installed on mounted Vue apps
- [`VueAdapterError`](#vueadaptererror): reports Vue mounting errors
- [TypeScript types](#typescript-types): public Vue adapter types

## `createVueAdapter()`

Creates a Makoo adapter that mounts Vue components.

### Type

```ts
function createVueAdapter(): VueMountAdapter;
```

### Returns

Returns `VueMountAdapter`.

### Details

The adapter uses `createApp(artifact, { makoo })` to create a Vue app, installs every plugin registered with `VuePlugin`, and mounts the app into the task's `mountPoint`. It calls `app.unmount()` when the task is unmounted.

Mounting or unmounting failures throw `VueAdapterError`.

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

Stores plugins that `createVueAdapter()` installs on each Vue app it creates.

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

| Method | Returns | Description |
| --- | --- | --- |
| `getPlugins()` | `Plugin[]` | Returns a copy of the current plugin list |
| `use(plugin)` | `void` | Registers one plugin; the same plugin instance is stored once |
| `usePlugins(...plugins)` | `void` | Registers multiple plugins |
| `clear()` | `void` | Removes every plugin |

### Example

```ts
VuePlugin.use(router);
VuePlugin.usePlugins(pinia, i18n);
```

## `VueAdapterError`

Error class used when the Vue adapter cannot mount or unmount a component. It extends `AdapterError`.

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

When `code` is omitted, it defaults to `ErrorCode.ADAPTER_MOUNT_FAIL`.

## TypeScript types

### `VueMountProps`

Props received by the Vue root component.

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
