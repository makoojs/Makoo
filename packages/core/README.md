# Core API Reference

## API Index

### Tasks

- [`createMakoo()`](#createmakoo): creates a runtime
- [`inject()`](#inject): declares a component task
- [`listen()`](#listen): declares a listener task

### Observation and state

- [`createObserverHub()`](#createobserverhub): creates a lifecycle event hub
- [`createActivityStore()`](#createactivitystore): creates subscribable state
- [`DOMWatcher`](#domwatcher): observes DOM targets

### Infrastructure

- [`Logger`](#logger): logger implementation
- [Error classes](#error-classes): structured errors
- [Constants](#constants): actions, event names, and error codes

### TypeScript types

- [Adapter types](#adapter-types)
- [Task types](#task-types)
- [Observer types](#observer-types)
- [Signal types](#signal-types)
- [Logger types](#logger-types)
- [Error types](#error-types)

## `createMakoo()`

Creates a Makoo runtime.

### Type

```ts
function createMakoo(options?: CreateMakooOptions): MakooRuntime;
```

### Parameters

`options` uses `CreateMakooOptions`:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `defaults` | `Partial<MakooDefaults>` | `{}` | Sets the default injection options |
| `adapters` | `ResolvableMountAdapter[]` | `[]` | Registers adapters that can mount artifacts |
| `hooks` | `LifecycleHookMap` | `undefined` | Registers global lifecycle hooks |
| `logger` | `ILogger` | `new Logger()` | Sets the logger implementation |
| `observer` | `ObserverHub` | `createObserverHub(logger)` | Sets the lifecycle event hub |

### Details

The final default values of `defaults` are:

```ts
{
	alive: false,
	scope: 'local',
	timeout: 5000
}
```

### Returns

Returns `MakooRuntime`:

| Method | Returns | Description |
| --- | --- | --- |
| `start(tasks)` | `StartedTasks` | Registers and starts a batch of `MakooTaskDeclaration`; an empty array throws `TaskError` |
| `reset(taskId)` | `void` | Resets a task and releases its current resources |
| `destroy(taskId)` | `void` | Destroys and removes a task |
| `resetAll()` | `void` | Resets every task in the runtime |
| `destroyAll()` | `void` | Destroys every task in the runtime |
| `enableAlive(taskId)` | `void` | Enables alive observation for a component task |
| `disableAlive(taskId)` | `void` | Disables alive observation for a component task |
| `on(event, hook)` | `() => void` | Subscribes to an event and returns an unsubscribe function |
| `onTask(taskId, event, hook)` | `() => void` | Subscribes to an event for one task and returns an unsubscribe function |
| `onAny(hook)` | `() => void` | Subscribes to all events and returns an unsubscribe function |
| `off(event, hook?)` | `void` | Removes one or all hooks for an event |
| `offTask(taskId, event?, hook?)` | `void` | Removes task hooks |
| `offAny(hook)` | `void` | Removes a hook registered with `onAny()` |
| `getLogger()` | `ILogger` | Returns the current logger |

Duplicate task IDs are skipped and are not included in the `StartedTasks.tasks` returned by that `start()` call.

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

Creates a component task declaration. `inject()` does not register or start the task; pass its result to `MakooRuntime.start()`.

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

When `id` is omitted, the runtime derives a task ID from the artifact and `injectAt`.

#### `ArtifactOptions`

| Field | Type | Description |
| --- | --- | --- |
| `alive` | `boolean` | Attempts to mount again after the target is replaced |
| `scope` | `'local' \| 'global'` | Observation scope used by alive mode |
| `timeout` | `number` | Milliseconds to wait for the target element |
| `on` | `MakooListenerDeclaration` | Event listener registered with the component |
| `hooks` | `LifecycleHookMap` | Lifecycle hooks for this task |

### Returns

Returns `MakooInjectionDeclaration<TArtifact>`.

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

Creates a listener task declaration. `listen()` does not register or start the task. Pass its result to `MakooRuntime.start()` or use it as `ArtifactOptions.on`.

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

When `id` is omitted, the runtime uses `listener-${listenAt}-${type}` as the task ID.
`capture` selects the DOM capture phase when `true`; it defaults to the browser behavior of
`false` (the bubbling phase). Makoo continues to manage the listener's abort signal internally.

### Returns

Returns `MakooListenerDeclaration`. It can be started as a standalone task or assigned to `ArtifactOptions.on`.

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

Creates an event hub. `logger` defaults to `new Logger()`.

### Type

```ts
function createObserverHub(logger?: ILogger): ObserverHub;
```

### Parameters

- `logger`: optional `ILogger`. A `Logger` is created when omitted.

### Returns

Returns `ObserverHub`:

| Method | Returns | Description |
| --- | --- | --- |
| `on(event, hook)` | `() => void` | Registers a hook for an event |
| `onTask(taskId, event, hook)` | `() => void` | Registers a task-specific hook |
| `onAny(hook)` | `() => void` | Registers a hook for every event |
| `off(event, hook?)` | `void` | Removes event hooks |
| `offTask(taskId, event?, hook?)` | `void` | Removes task hooks |
| `offAny(hook)` | `void` | Removes a global hook |
| `clear()` | `void` | Removes all hooks |
| `hasHooks(event?)` | `boolean` | Checks whether any or a specific event has hooks |
| `emit(event)` | `void` | Emits an event |
| `emitOnTask(taskId, event)` | `void` | Emits an event for a task |

Task events run task hooks, same-name event hooks, and `onAny()` hooks in that order. `stopPropagation()` prevents the next group from running. `stopImmediatePropagation()` also stops the remaining hooks in the current group. If a hook throws, the error is logged and the other hooks continue.

### Example

```ts
const observer = createObserverHub();
const off = observer.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId);
});

off();
```

## `createActivityStore()`

Creates readable, subscribable, and writable state.

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

- `initialValue`: the initial state value.

### Returns

Returns an object with `get()`, `subscribe()`, `set()`, and `update()`.

### Details

`set()` and `update()` compare the new and current values with `Object.is()` and do not notify subscribers when the value is unchanged.

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

Finds an existing matching element and observes subsequently added elements with `MutationObserver`.

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

- Calls `callback` when an element is found.
- Stops after the first match when `once: true`.
- Stops when `timeout` expires.
- Returns a function that stops observation.

### `DOMWatcher.onDomAlive()`

Observes removal of `target` and calls `onRestore` when a new element matching `selector` appears.

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

Returns a function that stops both removal and restoration observation.

## `Logger`

Makoo's default logger implementation.

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

The default level is `info`. Level order is `debug`, `info`, `warn`, and `error`; messages below the current level are not emitted.

## Error classes

### `MakooError`

```ts
class MakooError extends Error {
	readonly code: string;
	readonly issues: MakooIssue[];
	override readonly cause?: Error;

	constructor(
		message: string,
		issues?: MakooIssue[],
		code?: string,
		cause?: Error
	);
}
```

`message` receives a `[makoo]` prefix and includes the `issues` and `cause` error chain.

### `AdapterError`

```ts
class AdapterError extends MakooError;
```

Default code: `ErrorCode.ADAPTER_NOT_FOUND`.

### `SignalError`

```ts
class SignalError extends MakooError;
```

Default code: `ErrorCode.TASK_SIGNAL_INVALID`.

### `TaskError`

```ts
class TaskError extends MakooError;
```

Default code: `ErrorCode.TASK_NO_REGISTERED`.

## Constants

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

| Field | Value |
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
| `TASK_SIGNAL_INVALID` | `MAKOO_TASK_SIGNAL_INVALID` |
| `TASK_SIGNAL_BIND_FAIL` | `MAKOO_TASK_SIGNAL_BIND_FAIL` |
| `CLI_SOURCE_DIR_NOT_FOUND` | `MAKOO_CLI_SOURCE_DIR_NOT_FOUND` |
| `CLI_MANIFEST_LOAD_FAIL` | `MAKOO_CLI_MANIFEST_LOAD_FAIL` |
| `CLI_MODULE_MANIFEST_LOAD_FAIL` | `MAKOO_CLI_MODULE_MANIFEST_LOAD_FAIL` |
| `CLI_MANIFEST_NOT_FOUND` | `MAKOO_CLI_MANIFEST_NOT_FOUND` |
| `CLI_MANIFEST_BINDING_NOT_FOUND` | `MAKOO_CLI_MANIFEST_BINDING_NOT_FOUND` |
| `CLI_MANIFEST_IMPORT_NOT_FOUND` | `MAKOO_CLI_MANIFEST_IMPORT_NOT_FOUND` |
| `CLI_FUNCTION_SERIALIZATION_UNSUPPORTED` | `MAKOO_CLI_FUNCTION_SERIALIZATION_UNSUPPORTED` |
| `CLI_NO_ENABLED_TASKS` | `MAKOO_CLI_NO_ENABLED_TASKS` |
| `CLI_COMPONENT_NOT_FOUND` | `MAKOO_CLI_COMPONENT_NOT_FOUND` |
| `CLI_CONFIG_INVALID` | `MAKOO_CLI_CONFIG_INVALID` |
| `CLI_UNKNOWN_FRAMEWORK` | `MAKOO_CLI_UNKNOWN_FRAMEWORK` |
| `CLI_UNSUPPORTED_FRAMEWORK` | `MAKOO_CLI_UNSUPPORTED_FRAMEWORK` |
| `CLI_MODULE_ALREADY_EXISTS` | `MAKOO_CLI_MODULE_ALREADY_EXISTS` |
| `CLI_MANIFEST_VALIDATION_FAIL` | `MAKOO_CLI_MANIFEST_VALIDATION_FAIL` |
| `CLI_VITE_CONFIG_NOT_FOUND` | `MAKOO_CLI_VITE_CONFIG_NOT_FOUND` |
| `CLI_PLUGIN_NOT_FOUND` | `MAKOO_CLI_PLUGIN_NOT_FOUND` |
| `CLI_RUNTIME_SETUP_NOT_FOUND` | `MAKOO_CLI_RUNTIME_SETUP_NOT_FOUND` |

## Adapter types

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

| Field | Type |
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

| Field | Type |
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

## Task types

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

`StartedTasks.resetAll()` and `StartedTasks.destroyAll()` only affect the task batch returned by that `start()` call.

### `InjectionConfig`

```ts
type InjectionConfig = MakooDefaults & {
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
```

## Observer types

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

## Signal types

```ts
type SignalUnsubscribe = (() => void) | { unsubscribe(): void };

type ActivitySignalSource<T = boolean> = {
	get(): T;
	subscribe(listener: (value: T) => void): SignalUnsubscribe;
};

type ActivitySignalSubscribable<T = boolean> = ActivitySignalSource<T>;
```

## Logger types

```ts
type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

interface ILogger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}
```

## Error types

```ts
type MakooIssue = {
	path: string;
	message: string;
};

type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
```
