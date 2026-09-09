# DOM、日志与错误

本页 API 从 `@makoojs/core` 导入。

## `DOMWatcher`

### `DOMWatcher.onDomReady()`

立即查找匹配元素，并通过 `MutationObserver` 监听后续新增元素。

#### 类型 {#type}

```ts
declare const DOMWatcher: {
	onDomReady(
		selector: string,
		callback: (element: HTMLElement, observer?: MutationObserver) => void,
		root: Document | HTMLElement | undefined,
		options: { once: boolean; timeout?: number } | { once?: boolean; timeout: number },
		runtime?: {
			logger: ILogger;
			emit: (name:
				| 'dom:targetFound'
				| 'dom:targetTimeout'
				| 'dom:targetRemoved'
				| 'dom:targetRestored'
			) => void;
		}
	): () => void;
};
```

#### 说明 {#details}

- 找到元素时调用 `callback`。
- `once: true` 会在首次找到元素后停止观察。
- 设置 `timeout` 后，超时会停止观察。
- 返回值用于手动停止观察。

`root` 传入 `undefined` 时使用 `document`。例如等待工具栏首次出现：

```ts
import { DOMWatcher } from '@makoojs/core';

DOMWatcher.onDomReady(
  '#toolbar',
  (element) => console.log('Toolbar ready:', element),
  document,
  { once: true, timeout: 5000 }
);
```

### `DOMWatcher.onDomAlive()`

监听 `target` 被移除，并在 `selector` 对应的新元素出现时调用 `onRestore`。

#### 类型 {#type-1}

```ts
declare const DOMWatcher: {
	onDomAlive(
		target: HTMLElement,
		selector: string,
		onRemove: () => void,
		onRestore: (element: HTMLElement, observer?: MutationObserver) => void,
		root: Document | HTMLElement | undefined,
		options: { once: boolean; timeout?: number } | { once?: boolean; timeout: number },
		runtime?: {
			logger: ILogger;
			emit: (name:
				| 'dom:targetFound'
				| 'dom:targetTimeout'
				| 'dom:targetRemoved'
				| 'dom:targetRestored'
			) => void;
		}
	): () => void;
};
```

#### 返回值 {#returns}

`root` 控制移除观察的范围；目标移除后，在 `document` 中等待匹配元素恢复。返回的停止函数会结束这两种观察。

## `Logger`

Makoo 默认提供的日志实现。

### 类型 {#type-2}

```ts
class Logger implements ILogger {
	static readonly PREFIX = '[Makoo]';

	constructor(level?: LoggerLevel);
	setLevel(level: LoggerLevel): void;
	getLevel(): LoggerLevel;
	log(level: LoggerLevel, message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}
```

默认日志等级为 `info`。等级顺序为 `debug`、`info`、`warn`、`error`；低于当前等级的日志不会输出。

## 错误类

### `MakooError`

```ts
class MakooError extends Error {
	readonly code: string;
	readonly issues: MakooIssue[];
	readonly summary: string;
	readonly context: MakooErrorContext;
	override readonly cause?: Error;

	constructor(
		message: string,
		issues?: MakooIssue[],
		code?: string,
		cause?: Error
	);

	withContext(context: MakooErrorContext): this;
}
```

`message` 会添加 `[makoo]` 前缀并包含 `issues`。`cause` 保存在错误对象上，Makoo 格式化日志时会输出它的堆栈。`withContext()` 用于补充结构化上下文，不会改变错误码和摘要。

### `AdapterError`

```ts
declare class AdapterError extends MakooError {}
```

默认错误码：`ErrorCode.ADAPTER_NOT_FOUND`。

### `SignalError`

```ts
declare class SignalError extends MakooError {}
```

默认错误码：`ErrorCode.TASK_SIGNAL_INVALID`。

### `TaskError`

```ts
declare class TaskError extends MakooError {}
```

默认错误码：`ErrorCode.TASK_NO_REGISTERED`。

## 常量

### `Action`

```ts
enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}

type ActionEvent = `${Action}`;
```

### `OBSERVE_EVENT_NAMES`

```ts
const OBSERVE_EVENT_NAMES = [
	'register:start',
	'register:success',
	'register:duplicate',
	'register:error',
	'start:requested',
	'start:taskScheduled',
	'start:taskSkipped',
	'artifact:mountStart',
	'artifact:mountSuccess',
	'artifact:mountFail',
	'listener:attached',
	'listener:detached',
	'listener:attachFail',
	'alive:enabled',
	'alive:disabled',
	'alive:observerStarted',
	'alive:observerStopped',
	'task:targetReady',
	'task:statusChange',
	'task:beforeReset',
	'task:afterReset',
	'task:beforeDestroy',
	'task:afterDestroy',
	'signal:watcherReleased',
	'resource:listenerReleased',
	'artifact:unmounted',
	'dom:targetFound',
	'dom:targetTimeout',
	'dom:targetRemoved',
	'dom:targetRestored'
] as const;
```

### `ErrorCode`

| 字段 | 值 |
| --- | --- |
| `UNKNOWN` | `MAKOO_UNKNOWN` |
| `ADAPTER_NOT_FOUND` | `MAKOO_ADAPTER_NOT_FOUND` |
| `ADAPTER_MOUNT_FAIL` | `MAKOO_ADAPTER_MOUNT_FAIL` |
| `ADAPTER_UNMOUNT_FAIL` | `MAKOO_ADAPTER_UNMOUNT_FAIL` |
| `TASK_NO_REGISTERED` | `MAKOO_TASK_NO_REGISTERED` |
| `TASK_NOT_FOUND` | `MAKOO_TASK_NOT_FOUND` |
| `TASK_INJECT_FAIL` | `MAKOO_TASK_INJECT_FAIL` |
| `TASK_ALREADY_MOUNTED` | `MAKOO_TASK_ALREADY_MOUNTED` |
| `TASK_TARGET_DETACHED` | `MAKOO_TASK_TARGET_DETACHED` |
| `TASK_LISTENER_ATTACH_FAIL` | `MAKOO_TASK_LISTENER_ATTACH_FAIL` |
| `TASK_ROOT_REMOVE_FAIL` | `MAKOO_TASK_ROOT_REMOVE_FAIL` |
| `TASK_LISTENER_ABORT_FAIL` | `MAKOO_TASK_LISTENER_ABORT_FAIL` |
| `TASK_WATCHER_STOP_FAIL` | `MAKOO_TASK_WATCHER_STOP_FAIL` |
| `TASK_SIGNAL_INVALID` | `MAKOO_TASK_SIGNAL_INVALID` |
| `TASK_SIGNAL_BIND_FAIL` | `MAKOO_TASK_SIGNAL_BIND_FAIL` |
| `HOOK_EXECUTION_FAIL` | `MAKOO_HOOK_EXECUTION_FAIL` |

## 日志类型

```ts
type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

interface ILogger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}
```

## 错误类型

```ts
type MakooIssue = {
	path: string;
	message: string;
};

type MakooErrorContextValue = string | number | boolean | null;
type MakooErrorContext = Record<string, MakooErrorContextValue>;

type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
```
