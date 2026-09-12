# Runtime and Tasks

Import the APIs on this page from `@makoojs/core`. The examples use `Panel.vue` from [Component Injection](../docs/injection.md).

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

```json
{
  "alive": false,
  "scope": "local",
  "timeout": 5000
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
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const makoo = createMakoo({ adapters: [createVueAdapter()] });
makoo.start([
  inject({ id: 'panel', injectAt: 'body', artifact: Panel })
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
| `alive` | `boolean` | Waits for the same selector and mounts again after the host target is removed |
| `scope` | `'local' \| 'global'` | Observation scope used by alive mode |
| `timeout` | `number` | Milliseconds to wait for the target element |
| `on` | `MakooListenerDeclaration` | Event listener registered with the component |
| `hooks` | `LifecycleHookMap` | Lifecycle hooks for this task |

### Returns

Returns `MakooInjectionDeclaration<TArtifact>`.

### Example

```ts
import { inject } from '@makoojs/core';
import Panel from './Panel.vue';

const declaration = inject({
	id: 'settings-panel',
	injectAt: '#settings',
	artifact: Panel,
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
`capture` defaults to `false`. Set it to `true` to run the listener during the DOM capture phase.

### Returns

Returns `MakooListenerDeclaration`. It can be started as a standalone task or assigned to `ArtifactOptions.on`.

### Example

```ts
import { listen } from '@makoojs/core';

const onEscape: EventListener = (event) => {
  if (event instanceof KeyboardEvent && event.key === 'Escape') {
    console.log('Escape pressed');
  }
};

const declaration = listen({
	id: 'escape-close',
	listenAt: 'body',
	type: 'keydown',
	capture: true,
	callback: onEscape
});
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

Listener handles return whether `open()` / `close()` successfully changed listening state. They return `false` if already in that state or the operation cannot complete. See [Event Listeners](../docs/listeners.md).

### `InjectionConfig`

```ts
type InjectionConfig = MakooDefaults & {
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
```
