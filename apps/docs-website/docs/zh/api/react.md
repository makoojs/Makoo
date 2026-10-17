# React API

本页 API 从 `@makoojs/react` 导入。

## `createReactAdapter()`

创建名称为 `'react'` 的组件适配器。

```ts
function createReactAdapter(): ReactMountAdapter;
```

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'react', component: Panel })
]);
```

每次挂载时，适配器在组件容器上调用 `createRoot()`，并用 `root.render()` 渲染组件；`render()` 返回即视为挂载成功，不等待首次提交或 effect。卸载时调用 `root.unmount()`。

因此组件首次渲染时，状态通常已经是 `mounted`。渲染期间抛出的错误（包括 hooks 找不到名称）由 React 自己处理，不会让这次挂载失败，注入仍保持 `mounted`；需要兜底时请在组件内使用 Error Boundary。

声明中的 `props` 作为组件的 props 传入。

## Hooks

以下 hooks 只能在 Makoo 挂载的 React 组件树中调用，子组件同样可用；否则抛出 `MAKOO_REACT_HOOK_OUTSIDE_COMPONENT`。所有订阅都在组件卸载时自动释放。

| Hook | 返回 | 是否订阅 |
| --- | --- | --- |
| [`useComponentCommand()`](#usecomponentcommand) | 所属组件的命令入口 | 否 |
| [`useComponentStatus()`](#usecomponentstatus) | 组件状态 | 是 |
| [`useAttachedListenerStatus()`](#useattachedlistenerstatus) | 某个附属监听的状态 | 是 |
| [`useGlobalListener()`](#usegloballistener) | 独立监听的命令和状态 | 是 |
| [`useComponentStatusHandle()`](#usecomponentstatushandle) | 所属组件的原始状态入口 | 否 |

```tsx
import { useAttachedListenerStatus, useComponentCommand } from '@makoojs/react';

export default function Panel() {
  const { remove } = useComponentCommand();
  const search = useAttachedListenerStatus('search-submit');

  return (
    <aside>
      <p>搜索框：{search}</p>
      <button onClick={() => remove()}>关闭</button>
    </aside>
  );
}
```

### `useComponentCommand()`

```ts
function useComponentCommand(): ComponentCommand;
```

返回所属组件的[命令入口](./status.md#命令入口)。同一次挂载内引用稳定，不建立状态订阅，可以放进 effect 依赖。

### `useComponentStatus()`

```ts
function useComponentStatus(): ComponentStatus;
function useComponentStatus<T>(select: (status: ComponentStatus) => T): T;
```

订阅所属组件的状态。传入选择器时返回选择结果，结果按 `Object.is` 比较，不变时不触发重新渲染。选择器若每次返回新对象，状态一变就会重新渲染；请返回布尔值、字符串等原始值。

```ts
const failed = useComponentStatus((status) => status === 'failed');
```

### `useAttachedListenerStatus()`

```ts
function useAttachedListenerStatus(name: string): ListenerStatus;
function useAttachedListenerStatus<T>(name: string, select: (status: ListenerStatus) => T): T;
```

只订阅所属组件中名为 `name` 的附属监听。`name` 变化时切换订阅。名称不存在时抛出 `MAKOO_LISTENER_NOT_FOUND`。

### `useGlobalListener()`

```ts
function useGlobalListener(name: string): ListenerCommand & {
  readonly status: ListenerStatus;
  readonly lastError: MakooError | undefined;
};
```

查找同一 Core 实例中的独立监听，返回它的命令入口方法，并订阅其状态。组件卸载只释放订阅，不会停止这个监听。

找不到独立监听时（名称不存在、属于组件，或只是附属监听）抛出 `MAKOO_INJECTION_NOT_FOUND`。

每次渲染都会重新查找。该独立监听被移除并重新 `apply()` 后，下一次渲染才会取得新监听的命令和状态。回调出错时状态保持 `bound`，只写入 `lastError`，不会触发重新渲染。

```tsx
function ShortcutToggle() {
  const shortcut = useGlobalListener('shortcut');

  return (
    <button onClick={() => (shortcut.status === 'idle' ? shortcut.start() : shortcut.stop())}>
      快捷键：{shortcut.status}
    </button>
  );
}
```

### `useComponentStatusHandle()`

```ts
function useComponentStatusHandle(): ComponentStatusHandle;
```

返回所属组件的原始[状态入口](./status.md#状态入口)，与 `core.statusHandle(name)` 相同。取得它不会建立订阅，常用于读取 `lastError`：

```tsx
const failed = useComponentStatus((status) => status === 'failed');
const { lastError } = useComponentStatusHandle();

return failed ? <p>{lastError?.message}</p> : null;
```

`lastError` 不是状态快照的一部分，读取它不会触发更新。上例通过订阅 `failed` 在出错时重新渲染，再读取 `lastError`。

## `ReactErrorCode`

| 常量 | 值 |
| --- | --- |
| `REACT_HOOK_OUTSIDE_COMPONENT` | `'MAKOO_REACT_HOOK_OUTSIDE_COMPONENT'` |

## 类型

```ts
type ReactMountComponent = ComponentType<any>;
type ReactMountProps = Record<string, unknown>;
type ReactMountRoot = Root;
type ReactMountAdapter = MountAdapter<ReactMountComponent, ReactMountProps, ReactMountRoot>;
```
