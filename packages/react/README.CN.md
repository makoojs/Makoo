# @makoojs/react

`@makoojs/react` 是 Makoo 的 React 挂载适配器。它把 React 组件接入 `@makoojs/core` 的 adapter 协议，让 Makoo runtime 可以在目标 DOM 出现后创建 React root、渲染组件，并在任务销毁或重置时正确卸载。

## 适用场景

- 在 Makoo 项目中注入 React 组件。
- 让 `@makoojs/core` runtime 能识别并挂载 React artifact。
- 直接使用 core runtime 时手动注册 React adapter。
- 在 React 组件中读取 Makoo 传入的任务上下文 `makoo`。

## 安装

```bash
# npm install @makoojs/react
# yarn add @makoojs/react
pnpm add @makoojs/react
```

`@makoojs/react` 依赖 `@makoojs/core`，并把 `react`、`react-dom` 作为 peer dependencies，所以使用该包之前要安装好`react`、`react-dom`

## React 组件中的 Makoo 上下文

React adapter 会把 `makoo` 作为组件 props 传入。组件可以通过它读取当前任务 ID、目标选择器、logger，或控制当前任务生命周期。

```tsx
import type { ReactMountProps } from '@makoojs/react';

export default function Badge({ makoo }: ReactMountProps) {
	return (
		<button
			type="button"
			onClick={() => {
				makoo.getLogger().info(`clicked ${makoo.taskId}`);
			}}
		>
			Makoo Badge
		</button>
	);
}
```

`makoo` 来自 `@makoojs/core` 的 `MakooContext`，常用能力包括：

| 能力 | 说明 |
| --- | --- |
| `taskId` | 当前注入任务 ID |
| `injectAt` | 当前任务的目标选择器 |
| `enableAlive()` / `disableAlive()` | 控制当前任务的 alive 重注入 |
| `reset()` / `destroy()` | 重置或销毁当前任务 |
| `on()` / `onTask()` | 监听生命周期观察事件 |
| `getLogger()` | 获取当前 runtime 的 logger |

## 配合 @makoojs/core 使用

把 React adapter 传给 `createMakoo()`，再通过 `inject()` 声明 React 组件任务。

```tsx
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Badge from './Badge';

const makoo = createMakoo({
	defaults: {
		alive: true,
		scope: 'local',
		timeout: 5000
	},
	adapters: [createReactAdapter()]
});

makoo.start([
	inject({
		id: 'badge',
		injectAt: '#app',
		artifact: Badge
	})
]);
```

`createReactAdapter()` 返回的 adapter 会：

- 使用 `react-dom/client` 的 `createRoot(mountPoint)` 创建 React root。
- 使用 `root.render(createElement(artifact, { makoo }))` 渲染组件。
- 在 unmount 时调用 `root.unmount()`。
- 将 mount/unmount 错误包装成 `ReactAdapterError`。

## 类型导出

`@makoojs/react` 导出以下常用类型：

| 类型 | 说明 |
| --- | --- |
| `ReactMountProps` | React 组件接收到的 props，包含 `makoo` |
| `ReactMountArtifact` | Makoo 可识别的 React artifact 类型 |
| `ReactMountAdapter` | React adapter 类型 |
| `ReactMountRoot` | React root handle 类型 |

也会导出：

- `createReactAdapter`
- `ReactAdapterError`

详细接口见文档站的 React API。

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoojs/react` | React 挂载适配器 |
| `@makoojs/core` | 提供 runtime API、adapter 协议和 Makoo runtime context |
| `@makoojs/cli` | 提供 Makoo 项目的开发与构建能力 |

`@makoojs/react` 需要配合 `@makoojs/core` 的注入调度能力使用。
