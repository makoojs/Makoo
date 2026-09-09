# DOM, Logging and Errors

Import the APIs on this page from `@makoojs/core`.

## `DOMWatcher`

### `DOMWatcher.onDomReady()`

Finds an existing matching element and observes subsequently added elements with `MutationObserver`.

#### Type

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

#### Details

- Calls `callback` when an element is found.
- Stops after the first match when `once: true`.
- Stops when `timeout` expires.
- Returns a function that stops observation.

Passing `undefined` for `root` uses `document`. For example, wait for a toolbar to appear:

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

Observes removal of `target` and calls `onRestore` when a new element matching `selector` appears.

#### Type

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

#### Returns

`root` controls removal observation. After removal, the watcher waits for a matching element in `document`. The returned function stops both observers.

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

`message` receives a `[makoo]` prefix and includes `issues`. `cause` is stored on the error and its stack is included when Makoo formats the error for logging. `withContext()` appends structured context without changing the error code or summary.

### `AdapterError`

```ts
declare class AdapterError extends MakooError {}
```

Default code: `ErrorCode.ADAPTER_NOT_FOUND`.

### `SignalError`

```ts
declare class SignalError extends MakooError {}
```

Default code: `ErrorCode.TASK_SIGNAL_INVALID`.

### `TaskError`

```ts
declare class TaskError extends MakooError {}
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
| `TASK_ROOT_REMOVE_FAIL` | `MAKOO_TASK_ROOT_REMOVE_FAIL` |
| `TASK_LISTENER_ABORT_FAIL` | `MAKOO_TASK_LISTENER_ABORT_FAIL` |
| `TASK_WATCHER_STOP_FAIL` | `MAKOO_TASK_WATCHER_STOP_FAIL` |
| `TASK_SIGNAL_INVALID` | `MAKOO_TASK_SIGNAL_INVALID` |
| `TASK_SIGNAL_BIND_FAIL` | `MAKOO_TASK_SIGNAL_BIND_FAIL` |
| `HOOK_EXECUTION_FAIL` | `MAKOO_HOOK_EXECUTION_FAIL` |

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

type MakooErrorContextValue = string | number | boolean | null;
type MakooErrorContext = Record<string, MakooErrorContextValue>;

type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
```
