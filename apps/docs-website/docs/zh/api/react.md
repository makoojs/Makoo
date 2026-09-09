# React API

## API 索引

- [`createReactAdapter()`](#createreactadapter)：创建 React 挂载 adapter
- [`ReactAdapterError`](#reactadaptererror)：React 挂载错误
- [TypeScript 类型](#typescript-类型)：React adapter 的公开类型

## `createReactAdapter()`

创建用于挂载 React 组件的 Makoo adapter。

### 类型 {#type}

```ts
function createReactAdapter(): ReactMountAdapter;
```

### 返回值 {#returns}

返回 `ReactMountAdapter`。

### 说明 {#details}

adapter 使用 `createRoot()` 在任务的 `mountPoint` 中渲染组件，并把 `makoo` 作为组件 props 传入。任务卸载时调用 React root 的 `unmount()`。

挂载或卸载失败时抛出 `ReactAdapterError`。

### 示例 {#example}

```tsx
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel.tsx';

const makoo = createMakoo({
	adapters: [createReactAdapter()]
});

makoo.start([
	inject({ injectAt: '#app', artifact: Panel })
]);
```

## `ReactAdapterError`

React adapter 挂载或卸载失败时使用的错误类，继承自 `AdapterError`。

### 类型 {#type-1}

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

`code` 省略时使用 `ErrorCode.ADAPTER_MOUNT_FAIL`。

## TypeScript 类型

### `ReactMountProps`

React 根组件接收的 props。

```ts
type ReactMountProps = {
	makoo: MakooContext;
};
```

### `ReactMountArtifact`

Makoo React adapter 可以挂载的组件类型。

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

组件示例及 `makoo` prop 的接收方式见[组件注入](../docs/injection.md)。Context 的完整方法见 [MakooContext](./adapters.md#makoocontext)。
