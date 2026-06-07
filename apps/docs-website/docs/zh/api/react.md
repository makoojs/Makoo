# @makoojs/react

`@makoojs/react` 提供 React adapter，让 Makoo 能把 React 组件挂载到注入任务中。

## 导出概览

```ts
import { createReactAdapter, ReactAdapterError } from '@makoojs/react';
```

类型：

```ts
import type {
	ReactMountAdapter,
	ReactMountArtifact,
	ReactMountProps,
	ReactMountRoot
} from '@makoojs/react';
```

## createReactAdapter()

创建 React 挂载适配器。

```ts
import { Injector } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel';

const injector = new Injector();

injector.applyAdapter(createReactAdapter());
injector.register('body', Panel);
injector.run();
```

签名：

```ts
function createReactAdapter(): ReactMountAdapter;
```

adapter 会：

1. 判断 artifact 是否是可挂载的 React 组件。
2. 使用 `createRoot(mountPoint)` 创建 React root。
3. 使用 `root.render(createElement(artifact, { makoo }))` 渲染组件。
4. 在 reset、destroy 或 remount 时调用 `root.unmount()`。

## 组件 props

React 组件会收到一个 `makoo` prop：

```tsx
import type { ReactMountProps } from '@makoojs/react';

export function Panel({ makoo }: ReactMountProps) {
	return (
		<button onClick={() => makoo.destroy()}>
			Close
		</button>
	);
}
```

类型：

```ts
type ReactMountProps = {
	makoo: MakooContext;
};
```

`MakooContext` 来自 `@makoojs/core`，包含当前任务 id、目标选择器、reset/destroy、hooks、logger 和监听器控制方法。

## ReactMountArtifact

React adapter 支持普通函数组件和 React exotic component：

```ts
type ReactMountArtifact = ComponentType<ReactMountProps> | ExoticComponent<ReactMountProps>;
```

因此下面几种形式都适合注册：

```tsx
function Toolbar(props: ReactMountProps) {
	return <div />;
}

const MemoToolbar = memo(Toolbar);

injector.register('#toolbar', Toolbar);
injector.register('#toolbar', MemoToolbar);
```

## ReactMountAdapter

```ts
type ReactMountAdapter = ResolvableMountAdapter<
	ReactMountArtifact,
	ReactMountRoot,
	undefined
>;
```

其中 `ReactMountRoot` 是 `react-dom/client` 的 `Root`。

一般项目不需要直接操作这个类型，除非你在组合或测试 adapter。

## Manifest 中使用

通过 `@makoojs/cli` 使用 React 组件时，可以显式写 `framework: 'React'`：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.jsx',
			framework: 'React'
		}
	}
});
```

如果组件扩展名是 `.jsx` 或 `.tsx`，Makoo 也可以自动推断 React。显式写出 `framework` 会让 manifest 更清楚。

## ReactAdapterError

当 React adapter 挂载或卸载失败时，会抛出 `ReactAdapterError`。

```ts
import { ReactAdapterError } from '@makoojs/react';

try {
	injector.run();
} catch (error) {
	if (error instanceof ReactAdapterError) {
		console.error(error.code, error.issues);
	}
}
```

`ReactAdapterError` 继承自 `AdapterError`，因此也可以按 `@makoojs/core` 的错误基类统一处理。

## 注意事项

React adapter 会直接在 Makoo 提供的 `mountPoint` 上调用 `createRoot()`。对于浮窗类工具，如果你把任务注册到 `body`，实际项目里建议先创建一个独立子节点作为挂载点，再把组件挂到这个子节点，避免和宿主页面已有 React 或复杂 DOM 结构冲突。
