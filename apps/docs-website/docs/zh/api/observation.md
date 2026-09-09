# 事件与状态

本页 API 从 `@makoojs/core` 导入。

## `createObserverHub()`

创建用于订阅和发送任务生命周期事件的事件中心。

### 类型 {#type}

```ts
function createObserverHub(logger?: ILogger): ObserverHub;
```

### 参数 {#parameters}

- `logger`：可选的 `ILogger`。省略时创建 `Logger`。

### 返回值 {#returns}

返回 `ObserverHub`：

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `on(event, hook)` | `() => void` | 注册指定事件的 hook |
| `onTask(taskId, event, hook)` | `() => void` | 注册指定任务的 hook |
| `onAny(hook)` | `() => void` | 注册接收全部事件的 hook |
| `off(event, hook?)` | `void` | 移除指定事件的 hook |
| `offTask(taskId, event?, hook?)` | `void` | 移除指定任务的 hook |
| `offAny(hook)` | `void` | 移除一个全局 hook |
| `clear()` | `void` | 移除全部 hook |
| `hasHooks(event?)` | `boolean` | 检查全部或指定事件是否存在 hook |
| `emit(event)` | `void` | 发出事件 |
| `emitOnTask(taskId, event)` | `void` | 为指定任务发出事件 |

任务事件的调用顺序是：任务 hook、同名事件 hook、`onAny()` hook。
`stopPropagation()` 会阻止进入下一层；`stopImmediatePropagation()` 还会停止当前层剩余 hook。
某个 hook 抛出异常时，异常会写入 logger，其他 hook 继续执行。

### 示例 {#example}

```ts
import { createMakoo, createObserverHub, listen } from '@makoojs/core';

const observer = createObserverHub();
observer.on('listener:attached', (event) => {
  console.log('Listener attached:', event.taskId);
});

createMakoo({ observer }).start([
  listen({
    id: 'page-click',
    listenAt: 'body',
    type: 'click',
    callback: (event) => console.log(event.target)
  })
]);
```

## `createActivityStore()`

创建一个可读取、订阅和修改的状态对象。

### 类型 {#type-1}

```ts
function createActivityStore<T>(initialValue: T): {
	get(): T;
	subscribe(listener: (value: T) => void): SignalUnsubscribe;
	set(value: T): void;
	update(updater: (value: T) => T): void;
};
```

### 参数 {#parameters-1}

- `initialValue`：状态的初始值。

### 返回值 {#returns-1}

返回包含 `get()`、`subscribe()`、`set()` 和 `update()` 的状态对象。

### 说明 {#details}

`subscribe()` 监听后续变化；通过 `get()` 读取当前值。`set()` 或 `update()` 使用 `Object.is()` 比较新旧值，只在值改变时通知订阅者。

### 示例 {#example-1}

```ts
import { createActivityStore } from '@makoojs/core';

const active = createActivityStore(true);
active.subscribe((value) => {
	console.log(value);
});

active.set(false);
active.update((value) => !value);
```

## 观察类型

```ts
type ObserveEventName = (typeof OBSERVE_EVENT_NAMES)[number];

type ObserveEvent = {
	name: ObserveEventName;
	ts: number;
	taskId?: string;
	kind?: 'component' | 'listener';
	injectAt?: string;
	status?: 'idle' | 'pending' | 'active';
	durationMs?: number;
	error?: unknown;
	preStatus?: 'idle' | 'pending' | 'active';
	meta?: Record<string, unknown>;
};

type ObserveHook = (
	event: ObserveEvent,
	ctrl: {
		stopPropagation(): void;
		stopImmediatePropagation(): void;
	}
) => void;

type LifecycleHookMap = Partial<
	Record<ObserveEventName, ObserveHook | ObserveHook[]>
>;
```

## Signal 类型

```ts
type SignalUnsubscribe = (() => void) | { unsubscribe(): void };

type ActivitySignalSource<T = boolean> = {
	get(): T;
	subscribe(listener: (value: T) => void): SignalUnsubscribe;
};

type ActivitySignalSubscribable<T = boolean> = ActivitySignalSource<T>;
```
