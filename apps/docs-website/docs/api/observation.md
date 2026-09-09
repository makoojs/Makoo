# Events and State

Import the APIs on this page from `@makoojs/core`.

## `createObserverHub()`

Creates a hub for subscribing to and emitting task lifecycle events.

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

`subscribe()` listens for future changes; use `get()` to read the current value. `set()` and `update()` compare values with `Object.is()` and notify subscribers when the value changes.

### Example

```ts
import { createActivityStore } from '@makoojs/core';

const active = createActivityStore(true);
active.subscribe((value) => {
	console.log(value);
});

active.set(false);
active.update((value) => !value);
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
