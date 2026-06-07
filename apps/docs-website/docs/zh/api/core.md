# @makoojs/core

`@makoojs/core` 是 Makoo 的框架无关运行时。它负责注册注入任务、等待 DOM 目标、调用适配器挂载组件、管理 alive 重新注入、事件监听、生命周期 hooks 和日志。

大多数项目会通过 `@makoojs/cli` 生成运行时入口，不需要手动创建 `Injector`。当你要写自定义运行时、测试注入行为，或开发新的框架 adapter 时，才会直接使用 core API。

## 导出概览

```ts
import {
	Injector,
	ObserverHub,
	Logger,
	createActivityStore,
	DOMWatcher,
	ErrorCode,
	MakooError,
	TaskError,
	AdapterError
} from '@makoojs/core';
```

常用类型：

```ts
import type {
	ArtifactOptions,
	InjectionConfig,
	RegisterResult,
	ListenerRegisterResult,
	MakooContext,
	MountAdapter,
	ResolvableMountAdapter,
	LifecycleHookMap,
	ObserveEvent,
	ObserveEventName,
	ObserveHook,
	ActivitySignalSource
} from '@makoojs/core';
```

## Injector

`Injector` 是 Makoo 的运行时调度器。它注册任务、查找目标节点、调度 adapter 挂载组件，并处理 reset、destroy 和 alive。

```ts
const injector = new Injector({
	alive: false,
	scope: 'local',
	timeout: 5000
});
```

构造配置：

```ts
type InjectionConfig = {
	alive: boolean;
	scope: 'local' | 'global';
	timeout: number;
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
```

常用方法：

| 方法 | 说明 |
| --- | --- |
| `applyAdapter(adapter)` | 注册 Vue、React 或自定义 adapter |
| `register(injectAt, artifact, options?)` | 注册组件注入任务 |
| `registerListener(listenAt, event, callback, activitySignal?)` | 注册纯事件监听任务 |
| `run()` | 启动所有已注册任务 |
| `reset(taskId)` / `resetAll()` | 重置单个或全部任务 |
| `destroy(taskId)` / `destroyAll()` | 销毁单个或全部任务 |
| `enableAlive(taskId)` / `disableAlive(taskId)` | 开启或关闭单个任务的 alive |
| `on(event, hook)` / `onTask(taskId, event, hook)` | 监听全局或任务级生命周期事件 |
| `onAny(hook)` | 监听所有生命周期事件 |
| `off(...)` / `offTask(...)` / `offAny(...)` | 移除 hooks |
| `getObserver()` | 获取当前 `ObserverHub` |
| `getLogger()` | 获取当前 logger |

### 注册组件

```ts
const result = injector.register('#toolbar', ToolbarWidget, {
	alive: true,
	scope: 'global',
	timeout: 10000
});

injector.run();
```

返回值：

```ts
type RegisterResult = {
	taskId: string;
	isSuccess: boolean;
	enableAlive: () => void;
	disableAlive: () => void;
};
```

### 注册事件监听

```ts
const result = injector.registerListener('#save', 'click', () => {
	console.log('saved');
});
```

返回值：

```ts
type ListenerRegisterResult = {
	taskId: string;
	isSuccess: boolean;
};
```

### ArtifactOptions

`register()` 的第三个参数用于覆盖当前任务的运行时行为：

```ts
type ArtifactOptions = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	on?: {
		listenAt: string;
		type: string;
		callback: EventListener;
		activitySignal?: TaskActivitySignal;
	};
	hooks?: LifecycleHookMap;
};
```

`on` 适合给组件任务同时绑定一个外部页面事件。例如组件挂载到 `#panel`，但监听宿主页面上的 `#refresh` 按钮。

## Adapter API

Makoo 不直接依赖某个组件框架，而是通过 adapter 完成挂载。

```ts
type MountAdapter<TArtifact = unknown, THandle = unknown, TInstance = unknown> = {
	name: string;
	mount(input: AdapterMountInput<TArtifact>): AdapterMountResult<THandle, TInstance>;
	unmount(input: AdapterUnmountInput<THandle>): void;
};

type ResolvableMountAdapter<TArtifact = unknown, THandle = unknown, TInstance = unknown> =
	MountAdapter<TArtifact, THandle, TInstance> & {
		matches(artifact: unknown): artifact is TArtifact;
	};
```

`ResolvableMountAdapter` 需要额外提供 `matches()`，让 Injector 知道某个 artifact 应该由哪个 adapter 处理。

挂载输入：

```ts
type AdapterMountInput<TArtifact = unknown> = {
	host: HTMLElement;
	mountPoint: HTMLElement;
	artifact: TArtifact;
	taskId: string;
	injectAt: string;
	makoo: MakooContext;
};
```

卸载输入：

```ts
type AdapterUnmountInput<THandle = unknown> = {
	host?: HTMLElement;
	mountPoint: HTMLElement;
	handle: THandle;
	taskId: string;
	injectAt: string;
	reason: 'destroy' | 'reset' | 'remount' | 'manual';
};
```

## MakooContext

组件通过 adapter 挂载后，会收到一个 `makoo` context。React adapter 会把它作为 prop 传入，Vue adapter 也会作为 props 传入。

```ts
type MakooContext = {
	taskId: string;
	injectAt: string;
	enableAlive: () => void;
	disableAlive: () => void;
	reset: () => void;
	destroy: () => void;
	on: (event: ObserveEventName, hook: ObserveHook) => () => void;
	onTask: (event: ObserveEventName, hook: ObserveHook) => () => void;
	off: (event: ObserveEventName, hook?: ObserveHook) => void;
	offTask: (event?: ObserveEventName, hook?: ObserveHook) => void;
	getLogger: () => ILogger;
	bindListenerSignal: (source: ActivitySignalSource<boolean>) => boolean;
	controlListener: (event: 'OPEN' | 'CLOSE') => boolean;
};
```

它适合做组件内的生命周期控制和调试，例如在组件内部销毁当前任务：

```ts
function Widget({ makoo }: { makoo: MakooContext }) {
	return <button onClick={() => makoo.destroy()}>Close</button>;
}
```

## Lifecycle Hooks

Makoo 的运行时事件名称由 `OBSERVE_EVENT_NAMES` 导出。

```ts
import { OBSERVE_EVENT_NAMES } from '@makoojs/core';
```

事件类型：

```ts
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
```

常见事件包括：

- `register:start`
- `register:success`
- `run:start`
- `run:taskScheduled`
- `artifact:mountStart`
- `artifact:mountSuccess`
- `artifact:mountFail`
- `listener:attached`
- `alive:enabled`
- `task:statusChange`
- `dom:targetFound`
- `dom:targetTimeout`

使用方式：

```ts
const off = injector.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId, 'mounted');
});

off();
```

`ObserveHook` 的第二个参数支持停止传播：

```ts
injector.onAny((event, ctrl) => {
	if (event.name === 'artifact:mountFail') {
		ctrl.stopImmediatePropagation();
	}
});
```

## ObserverHub

`ObserverHub` 是 hooks 的底层事件中心。一般通过 `Injector` 间接使用。

```ts
const hub = new ObserverHub();

const off = hub.on('run:start', (event) => {
	console.log(event.name);
});

hub.emit({
	name: 'run:start',
	ts: Date.now()
});

off();
```

方法：

| 方法 | 说明 |
| --- | --- |
| `on(event, hook)` | 注册事件 hook |
| `onTask(taskId, event, hook)` | 注册任务级 hook |
| `onAny(hook)` | 注册全事件 hook |
| `off(event, hook?)` | 移除事件 hook |
| `offTask(taskId, event?, hook?)` | 移除任务级 hook |
| `offAny(hook)` | 移除全事件 hook |
| `emit(event)` | 触发事件 |
| `emitOnTask(taskId, event)` | 触发任务级事件 |
| `clear()` | 清空全部 hooks |
| `hasHooks(event?)` | 判断是否存在 hook |

## Activity Signal

`createActivityStore()` 用于创建可订阅的布尔状态，常用于控制监听器是否活跃。

```ts
const signal = createActivityStore(true);

signal.subscribe((active) => {
	console.log('active:', active);
});

signal.set(false);
signal.update((value) => !value);
```

类型：

```ts
type ActivitySignalStore<T = boolean> = {
	get(): T;
	subscribe(listener: (value: T) => void): SignalUnsubscribe;
};

type WritableActivitySignalStore<T = boolean> = ActivitySignalStore<T> & {
	set(value: T): void;
	update(updater: (value: T) => T): void;
};
```

## Logger

默认 logger 会把日志输出到控制台，并带上 `[Makoo]` 前缀和时间戳。

```ts
const logger = new Logger('debug');

logger.info('started');
logger.warn('slow target');
logger.error('failed');
logger.debug('task detail');

logger.setLevel('warn');
```

日志等级：

```ts
type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
```

## Errors

core 导出三类基础错误：

| 错误 | 说明 |
| --- | --- |
| `MakooError` | Makoo 结构化错误基类 |
| `TaskError` | 任务注册、运行或生命周期错误 |
| `AdapterError` | adapter 挂载或卸载错误 |

`ErrorCode` 提供稳定错误码，适合日志、测试和错误分类。

```ts
try {
	injector.run();
} catch (error) {
	if (error instanceof MakooError) {
		console.error(error.code, error.issues);
	}
}
```
