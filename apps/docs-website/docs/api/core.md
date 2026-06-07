# @makoojs/core

`@makoojs/core` is Makoo's framework-agnostic runtime. It registers injection tasks, waits for DOM targets, delegates component mounting to adapters, manages alive reinjection, binds listeners, emits lifecycle hooks, and logs runtime activity.

Most projects use it indirectly through `@makoojs/cli`. Use core APIs directly when you build a custom runtime, test injection behavior, or write a new framework adapter.

## Exports

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

Common types:

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

`Injector` is the runtime scheduler. It registers tasks, resolves target nodes, mounts artifacts through adapters, and handles reset, destroy, and alive behavior.

```ts
const injector = new Injector({
	alive: false,
	scope: 'local',
	timeout: 5000
});
```

Constructor config:

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

Common methods:

| Method | Description |
| --- | --- |
| `applyAdapter(adapter)` | Register a Vue, React, or custom adapter |
| `register(injectAt, artifact, options?)` | Register a component injection task |
| `registerListener(listenAt, event, callback, activitySignal?)` | Register a listener-only task |
| `run()` | Start all registered tasks |
| `reset(taskId)` / `resetAll()` | Reset one task or all tasks |
| `destroy(taskId)` / `destroyAll()` | Destroy one task or all tasks |
| `enableAlive(taskId)` / `disableAlive(taskId)` | Enable or disable alive for one task |
| `on(event, hook)` / `onTask(taskId, event, hook)` | Listen to global or task-scoped lifecycle events |
| `onAny(hook)` | Listen to every lifecycle event |
| `off(...)` / `offTask(...)` / `offAny(...)` | Remove hooks |
| `getObserver()` | Get the current `ObserverHub` |
| `getLogger()` | Get the current logger |

### Registering a Component

```ts
const result = injector.register('#toolbar', ToolbarWidget, {
	alive: true,
	scope: 'global',
	timeout: 10000
});

injector.run();
```

Return value:

```ts
type RegisterResult = {
	taskId: string;
	isSuccess: boolean;
	enableAlive: () => void;
	disableAlive: () => void;
};
```

### Registering a Listener

```ts
const result = injector.registerListener('#save', 'click', () => {
	console.log('saved');
});
```

Return value:

```ts
type ListenerRegisterResult = {
	taskId: string;
	isSuccess: boolean;
};
```

### ArtifactOptions

The third argument of `register()` overrides runtime behavior for one task:

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

`on` is useful when a component task also needs to bind an event outside the component. For example, mount a panel into `#panel` while listening to the host page's `#refresh` button.

## Adapter API

Makoo does not hard-code a component framework. Adapters perform the actual mount and unmount work.

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

`ResolvableMountAdapter` adds `matches()` so the injector can choose the right adapter for an artifact.

Mount input:

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

Unmount input:

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

Mounted components receive a `makoo` context. The React adapter passes it as a prop, and the Vue adapter passes it as props as well.

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

Example:

```ts
function Widget({ makoo }: { makoo: MakooContext }) {
	return <button onClick={() => makoo.destroy()}>Close</button>;
}
```

## Lifecycle Hooks

Makoo exports all runtime event names through `OBSERVE_EVENT_NAMES`.

```ts
import { OBSERVE_EVENT_NAMES } from '@makoojs/core';
```

Event payload:

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

Common events include:

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

Usage:

```ts
const off = injector.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId, 'mounted');
});

off();
```

Hooks receive a propagation controller as the second argument:

```ts
injector.onAny((event, ctrl) => {
	if (event.name === 'artifact:mountFail') {
		ctrl.stopImmediatePropagation();
	}
});
```

## ObserverHub

`ObserverHub` is the lifecycle event hub. Most applications use it through `Injector`.

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

Methods:

| Method | Description |
| --- | --- |
| `on(event, hook)` | Register an event hook |
| `onTask(taskId, event, hook)` | Register a task-scoped hook |
| `onAny(hook)` | Register a hook for every event |
| `off(event, hook?)` | Remove event hooks |
| `offTask(taskId, event?, hook?)` | Remove task-scoped hooks |
| `offAny(hook)` | Remove an any-event hook |
| `emit(event)` | Emit an event |
| `emitOnTask(taskId, event)` | Emit a task-scoped event |
| `clear()` | Remove all hooks |
| `hasHooks(event?)` | Check whether hooks exist |

## Activity Signal

`createActivityStore()` creates a subscribable state store, commonly used to control whether a listener is active.

```ts
const signal = createActivityStore(true);

signal.subscribe((active) => {
	console.log('active:', active);
});

signal.set(false);
signal.update((value) => !value);
```

Types:

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

The default logger writes to the console with a `[Makoo]` prefix and timestamp.

```ts
const logger = new Logger('debug');

logger.info('started');
logger.warn('slow target');
logger.error('failed');
logger.debug('task detail');

logger.setLevel('warn');
```

Levels:

```ts
type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
```

## Errors

Core exports three base error types:

| Error | Description |
| --- | --- |
| `MakooError` | Structured base error for Makoo |
| `TaskError` | Task registration, run, or lifecycle errors |
| `AdapterError` | Adapter mount or unmount errors |

`ErrorCode` provides stable error codes for logs, tests, and error classification.

```ts
try {
	injector.run();
} catch (error) {
	if (error instanceof MakooError) {
		console.error(error.code, error.issues);
	}
}
```
