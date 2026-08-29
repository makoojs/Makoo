# 核心 API

## API 索引

### 任务

- [`createMakoo()`](#createmakoo)：创建运行时
- [`inject()`](#inject)：声明 component 任务
- [`listen()`](#listen)：声明 listener 任务

### 观察和状态

- [`createObserverHub()`](#createobserverhub)：创建生命周期事件中心
- [`createActivityStore()`](#createactivitystore)：创建可订阅状态
- [`DOMWatcher`](#domwatcher)：观察 DOM 目标

### 基础能力

- [`Logger`](#logger)：日志实现
- [错误类](#错误类)：结构化错误
- [常量](#常量)：动作、事件名和错误码

### TypeScript 类型

- [Adapter 类型](#adapter-类型)
- [任务类型](#任务类型)
- [观察类型](#观察类型)
- [Signal 类型](#signal-类型)
- [日志类型](#日志类型)
- [错误类型](#错误类型)

## `createMakoo()`

创建一个 Makoo 运行时。

### Type

```ts
function createMakoo(options?: CreateMakooOptions): MakooRuntime;
```

### Parameters

`options` 使用 `CreateMakooOptions`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `defaults` | `Partial<MakooDefaults>` | `{}` | 设置 injection 的默认选项 |
| `adapters` | `ResolvableMountAdapter[]` | `[]` | 注册可用于挂载 artifact 的 adapter |
| `hooks` | `LifecycleHookMap` | `undefined` | 注册全局生命周期 hooks |
| `logger` | `ILogger` | `new Logger()` | 设置日志实现 |
| `observer` | `ObserverHub` | `createObserverHub(logger)` | 设置生命周期事件中心 |

### Details

`defaults` 的最终默认值：

```ts
{
	alive: false,
	scope: 'local',
	timeout: 5000
}
```

### Returns

返回 `MakooRuntime`：

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `start(tasks)` | `StartedTasks` | 注册并启动一批 `MakooTaskDeclaration`；空数组会抛出 `TaskError` |
| `reset(taskId)` | `void` | 重置指定任务并释放当前资源 |
| `destroy(taskId)` | `void` | 销毁并移除指定任务 |
| `resetAll()` | `void` | 重置当前运行时中的全部任务 |
| `destroyAll()` | `void` | 销毁当前运行时中的全部任务 |
| `enableAlive(taskId)` | `void` | 为 component 任务启用 alive 观察 |
| `disableAlive(taskId)` | `void` | 为 component 任务关闭 alive 观察 |
| `on(event, hook)` | `() => void` | 监听指定事件，返回取消监听函数 |
| `onTask(taskId, event, hook)` | `() => void` | 监听指定任务的指定事件，返回取消监听函数 |
| `onAny(hook)` | `() => void` | 监听全部事件，返回取消监听函数 |
| `off(event, hook?)` | `void` | 移除指定事件的一个或全部 hook |
| `offTask(taskId, event?, hook?)` | `void` | 按任务移除 hook |
| `offAny(hook)` | `void` | 移除通过 `onAny()` 注册的 hook |
| `getLogger()` | `ILogger` | 返回当前日志实现 |

重复的任务 ID 不会再次注册，也不会出现在本次 `start()` 返回的 `StartedTasks.tasks` 中。

### Example

```ts
const makoo = createMakoo({
	adapters: [adapter]
});

const started = makoo.start([
	inject({ injectAt: '#app', artifact })
]);
```

## `inject()`

创建 component 任务声明。调用 `inject()` 不会注册或启动任务，返回值需要传给
`MakooRuntime.start()`。

### Type

```ts
function inject<TArtifact>(
	input: MakooInjectionInput<TArtifact>
): MakooInjectionDeclaration<TArtifact>;
```

### Parameters

```ts
type MakooInjectionInput<TArtifact = unknown> = {
	id?: string;
	injectAt: string;
	artifact: TArtifact;
	options?: ArtifactOptions;
};
```

`id` 省略时，运行时会根据 artifact 和 `injectAt` 生成任务 ID。

#### `ArtifactOptions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `alive` | `boolean` | 宿主目标节点被移除后，是否等待同一选择器重新出现并重新挂载 |
| `scope` | `'local' \| 'global'` | alive 观察范围 |
| `timeout` | `number` | 等待目标元素的毫秒数 |
| `on` | `MakooListenerDeclaration` | 随 component 一起注册的事件监听 |
| `hooks` | `LifecycleHookMap` | 当前任务的生命周期 hooks |

### Returns

返回 `MakooInjectionDeclaration<TArtifact>`。

### Example

```ts
const declaration = inject({
	id: 'settings-panel',
	injectAt: '#settings',
	artifact: settingsPanel,
	options: {
		alive: true,
		scope: 'global'
	}
});
```

## `listen()`

创建 listener 任务声明。调用 `listen()` 不会注册或启动任务，返回值需要传给
`MakooRuntime.start()`，或者作为 `ArtifactOptions.on` 使用。

### Type

```ts
function listen(input: MakooListenerInput): MakooListenerDeclaration;
```

### Parameters

```ts
type MakooListenerInput = {
	id?: string;
	listenAt: string;
	type: string;
	callback: EventListener;
	capture?: boolean;
	activitySignal?: () => ActivitySignalSource<boolean>;
};
```

`id` 省略时，运行时使用 `listener-${listenAt}-${type}` 作为任务 ID。
`capture` 默认为 `false`；设置为 `true` 后，监听器会在 DOM 捕获阶段执行。listener 使用的
abort signal 仍由 Makoo 内部管理。

### Returns

返回 `MakooListenerDeclaration`。它可以作为独立任务启动，也可以赋给 `ArtifactOptions.on`。

### Example

```ts
const declaration = listen({
	id: 'escape-close',
	listenAt: 'body',
	type: 'keydown',
	capture: true,
	callback: onEscape
});
```

## `createObserverHub()`

创建事件中心。`logger` 默认使用 `new Logger()`。

### Type

```ts
function createObserverHub(logger?: ILogger): ObserverHub;
```

### Parameters

- `logger`：可选的 `ILogger`。省略时创建 `Logger`。

### Returns

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

### Example

```ts
const observer = createObserverHub();
const off = observer.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId);
});

off();
```

## `createActivityStore()`

创建一个可读取、订阅和修改的状态对象。

### Type

```ts
function createActivityStore<T>(initialValue: T): {
	get(): T;
	subscribe(listener: (value: T) => void): SignalUnsubscribe;
	set(value: T): void;
	update(updater: (value: T) => T): void;
};
```

### Parameters

- `initialValue`：状态的初始值。

### Returns

返回包含 `get()`、`subscribe()`、`set()` 和 `update()` 的状态对象。

### Details

`set()` 或 `update()` 产生的新值与当前值通过 `Object.is()` 比较；值没有变化时不会通知订阅者。

### Example

```ts
const active = createActivityStore(true);
const unsubscribe = active.subscribe((value) => {
	console.log(value);
});

active.set(false);
active.update((value) => !value);
unsubscribe();
```

## `DOMWatcher`

### `DOMWatcher.onDomReady()`

立即查找匹配元素，并通过 `MutationObserver` 监听后续新增元素。

#### Type

```ts
DOMWatcher.onDomReady(
	selector: string,
	callback: (element: HTMLElement, observer?: MutationObserver) => void,
	root: Document | HTMLElement = document,
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
```

#### Details

- 找到元素时调用 `callback`。
- `once: true` 会在首次找到元素后停止观察。
- 设置 `timeout` 后，超时会停止观察。
- 返回值用于手动停止观察。

### `DOMWatcher.onDomAlive()`

监听 `target` 被移除，并在 `selector` 对应的新元素出现时调用 `onRestore`。

#### Type

```ts
DOMWatcher.onDomAlive(
	target: HTMLElement,
	selector: string,
	onRemove: () => void,
	onRestore: (element: HTMLElement, observer?: MutationObserver) => void,
	root: Document | HTMLElement = document,
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
```

#### Returns

返回一个停止函数，用于停止移除和恢复观察。

## `Logger`

Makoo 默认提供的日志实现。

### Type

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
class AdapterError extends MakooError;
```

默认错误码：`ErrorCode.ADAPTER_NOT_FOUND`。

### `SignalError`

```ts
class SignalError extends MakooError;
```

默认错误码：`ErrorCode.TASK_SIGNAL_INVALID`。

### `TaskError`

```ts
class TaskError extends MakooError;
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

## Adapter 类型

### `MountAdapter`

```ts
interface MountAdapter<TArtifact = unknown, THandle = unknown, TInstance = unknown> {
	name: string;
	mount(input: AdapterMountInput<TArtifact>): AdapterMountResult<THandle, TInstance>;
	unmount(input: AdapterUnmountInput<THandle>): void;
}
```

### `ResolvableMountAdapter`

```ts
interface ResolvableMountAdapter<TArtifact = unknown, THandle = unknown, TInstance = unknown>
	extends MountAdapter<TArtifact, THandle, TInstance> {
	matches(artifact: unknown): artifact is TArtifact;
}
```

### `AdapterMountInput`

| 字段 | 类型 |
| --- | --- |
| `host` | `HTMLElement` |
| `mountPoint` | `HTMLElement` |
| `artifact` | `TArtifact` |
| `taskId` | `string` |
| `injectAt` | `string` |
| `makoo` | `MakooContext` |

### `AdapterMountResult`

```ts
type AdapterMountResult<THandle = unknown, TInstance = unknown> = {
	handle: THandle;
	instance?: TInstance;
};
```

### `AdapterUnmountInput`

| 字段 | 类型 |
| --- | --- |
| `host` | `HTMLElement \| undefined` |
| `mountPoint` | `HTMLElement` |
| `handle` | `THandle` |
| `taskId` | `string` |
| `injectAt` | `string` |
| `reason` | `AdapterUnmountReason` |

```ts
type AdapterUnmountReason = 'destroy' | 'reset' | 'remount' | 'manual';
type AdapterResolver = (artifact: unknown) => MountAdapter | undefined;
```

### `MakooContext`

```ts
type MakooContext = {
	taskId: string;
	injectAt: string;
	enableAlive(): void;
	disableAlive(): void;
	reset(): void;
	destroy(): void;
	on(event: ObserveEventName, hook: ObserveHook): () => void;
	onTask(event: ObserveEventName, hook: ObserveHook): () => void;
	off(event: ObserveEventName, hook?: ObserveHook): void;
	offTask(event?: ObserveEventName, hook?: ObserveHook): void;
	getLogger(): ILogger;
	bindListenerSignal(source: ActivitySignalSource<boolean>): boolean;
	controlListener(event: ActionEvent): boolean;
};
```

## 任务类型

```ts
type MakooDefaults = {
	alive: boolean;
	scope: 'local' | 'global';
	timeout: number;
};

type MakooInjectionDeclaration<TArtifact = unknown> = {
	kind: 'component';
	id?: string;
	injectAt: string;
	artifact: TArtifact;
	options?: ArtifactOptions;
};

type MakooListenerDeclaration = {
	kind: 'listener';
	id?: string;
	listenAt: string;
	event: string;
	type: string;
	callback: EventListener;
	capture?: boolean;
	activitySignal?: () => ActivitySignalSource<boolean>;
};

type MakooTaskDeclaration<TArtifact = unknown> =
	| MakooInjectionDeclaration<TArtifact>
	| MakooListenerDeclaration;
```

### `StartedTasks`

```ts
type StartedComponentTask = {
	kind: 'component';
	taskId: string;
	enableAlive(): void;
	disableAlive(): void;
	reset(): void;
	destroy(): void;
};

type StartedListenerTask = {
	kind: 'listener';
	taskId: string;
	open(): boolean;
	close(): boolean;
	destroy(): void;
};

type StartedTask = StartedComponentTask | StartedListenerTask;

type StartedTasks = {
	tasks: StartedTask[];
	get(taskId: string): StartedTask | undefined;
	resetAll(): void;
	destroyAll(): void;
};
```

`StartedTasks.resetAll()` 和 `StartedTasks.destroyAll()` 只操作当前 `start()` 返回的任务批次。

### `InjectionConfig`

```ts
type InjectionConfig = MakooDefaults & {
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
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
