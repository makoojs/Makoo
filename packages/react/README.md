# React API Reference

## API Index

- [`createReactAdapter()`](#createreactadapter): creates the React mounting adapter
- [`ReactAdapterError`](#reactadaptererror): reports React mounting errors
- [TypeScript types](#typescript-types): public React adapter types

## `createReactAdapter()`

Creates a Makoo adapter that mounts React components.

### Type

```ts
function createReactAdapter(): ReactMountAdapter;
```

### Returns

Returns `ReactMountAdapter`.

### Details

The adapter uses `createRoot()` to render a component into the task's `mountPoint` and passes `makoo` as component props. It calls `unmount()` on the React root when the task is unmounted.

Mounting or unmounting failures throw `ReactAdapterError`.

### Example

```tsx
const makoo = createMakoo({
	adapters: [createReactAdapter()]
});

makoo.start([
	inject('#app', Badge)
]);
```

## `ReactAdapterError`

Error class used when the React adapter cannot mount or unmount a component. It extends `AdapterError`.

### Type

```ts
class ReactAdapterError extends AdapterError {
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

### `ReactMountProps`

Props received by the React root component.

```ts
type ReactMountProps = {
	makoo: MakooContext;
};
```

### `ReactMountArtifact`

Component types accepted by the Makoo React adapter.

```ts
type ReactMountArtifact =
	| ComponentType<ReactMountProps>
	| ExoticComponent<ReactMountProps>;
```

### `ReactMountRoot`

```ts
type ReactMountRoot = Root;
```

### `ReactMountAdapter`

```ts
type ReactMountAdapter = ResolvableMountAdapter<
	ReactMountArtifact,
	ReactMountRoot,
	undefined
>;
```
