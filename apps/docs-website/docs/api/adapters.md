# Adapters and Context

Vue and React components receive their task Context through the `makoo` prop. Import the mounting interfaces below from `@makoojs/core` when creating a custom adapter.

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

`host` is the page element matching `injectAt`; `mountPoint` is the container Makoo creates inside it. Mount the `artifact` into `mountPoint`.

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
| `host?` | `HTMLElement` |
| `mountPoint` | `HTMLElement` |
| `handle` | `THandle` |
| `taskId` | `string` |
| `injectAt` | `string` |
| `reason` | `AdapterUnmountReason` |

```ts
type AdapterUnmountReason = 'destroy' | 'reset' | 'remount' | 'manual';
type AdapterResolver = (artifact: unknown) => MountAdapter | undefined;
```

Use the `handle` returned during mounting to release the framework instance on unmount. `reason` identifies why unmounting was requested.

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

`taskId` and `injectAt` identify the current component task. `destroy()` unmounts and removes the task; `reset()` releases its resources and retains its record.

`on()` subscribes to a named event across the Runtime; `onTask()` subscribes only to events for this task. Both return an unsubscribe function. `controlListener()` and `bindListenerSignal()` control the listener registered with the component through `options.on`.
