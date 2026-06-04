# @makoo/react

`@makoo/react` 是 Makoo 的 React 挂载适配器。它把 React 组件接入 `@makoo/core` 的 adapter 协议，让 `Injector` 可以在目标 DOM 出现后创建 React root、渲染组件，并在任务销毁或重置时正确卸载。

普通 Makoo 项目通常通过 `@makoo/cli` 使用这个包：当 manifest 中的模块被识别为 React 时，CLI 会在生成的虚拟入口中引入 React adapter。只有在你直接使用 `@makoo/core` 手动搭建运行时时，才需要显式调用 `createReactAdapter()`。

## 适用场景

- 在 Makoo 项目中注入 React 组件。
- 让 `@makoo/core` 的 `Injector` 能识别并挂载 React artifact。
- 直接使用 core runtime 时手动注册 React adapter。
- 在 React 组件中读取 Makoo 传入的任务上下文 `makoo`。

## 安装

```bash
// npm install @makoo/react 
// yarn add @makoo/react 
pnpm add @makoo/react 
```

`@makoo/react` 依赖 `@makoo/core`，并把 `react`、`react-dom` 作为 peer dependencies，所以使用该包之前要安装好`react`、`react-dom`

## 在 CLI 项目中使用

多数情况下，只需要在 manifest 中声明 React 组件即可。

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: {
		badge: {
			injectAt: 'body',
			component: './badge/App.tsx',
			framework: 'React'
		}
	}
});
```

如果 `framework` 省略或设置为 `auto`，Makoo 会根据 `.tsx` / `.jsx` 扩展名推断为 React。

## React 组件中的 Makoo 上下文

React adapter 会把 `makoo` 作为组件 props 传入。组件可以通过它读取当前任务 ID、目标选择器、logger，或控制当前任务生命周期。

```tsx
import type { ReactMountProps } from '@makoo/react';

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

`makoo` 来自 `@makoo/core` 的 `MakooContext`，常用能力包括：

| 能力 | 说明 |
| --- | --- |
| `taskId` | 当前注入任务 ID |
| `injectAt` | 当前任务的目标选择器 |
| `enableAlive()` / `disableAlive()` | 控制当前任务的 alive 重注入 |
| `reset()` / `destroy()` | 重置或销毁当前任务 |
| `on()` / `onTask()` | 监听生命周期观察事件 |
| `getLogger()` | 获取当前 injector 的 logger |

## 直接配合 @makoo/core 使用

如果你不经过 `@makoo/cli`，可以手动把 React adapter 注册到 `Injector`。

```tsx
import { Injector } from '@makoo/core';
import { createReactAdapter } from '@makoo/react';
import Badge from './Badge';

const injector = new Injector({
	alive: true,
	scope: 'local',
	timeout: 5000
}).applyAdapter(createReactAdapter());

injector.register('#app', Badge);
injector.run();
```

`createReactAdapter()` 返回的 adapter 会：

- 使用 `react-dom/client` 的 `createRoot(mountPoint)` 创建 React root。
- 使用 `root.render(createElement(artifact, { makoo }))` 渲染组件。
- 在 unmount 时调用 `root.unmount()`。
- 将 mount/unmount 错误包装成 `ReactAdapterError`。

## 类型导出

`@makoo/react` 导出以下常用类型：

| 类型 | 说明 |
| --- | --- |
| `ReactMountProps` | React 组件接收到的 props，包含 `makoo` |
| `ReactMountArtifact` | Makoo 可识别的 React artifact 类型 |
| `ReactMountAdapter` | React adapter 类型 |
| `ReactMountRoot` | React root handle 类型 |

也会导出：

- `createReactAdapter`
- `ReactAdapterError`

完整 API 参考后续会放到独立文档站中。

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoo/react` | React 挂载适配器 |
| `@makoo/core` | 提供 `Injector`、adapter 协议和 Makoo runtime context |
| `@makoo/cli` | 扫描 manifest、生成虚拟入口，并在需要时引入 React adapter |

`@makoo/react` 本身不是完整运行时。它需要配合 `@makoo/core` 的注入调度能力，或通过 `@makoo/cli` 自动生成的运行时代码来工作。
