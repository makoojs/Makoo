# Adapter 与 Context

Vue 和 React 组件通过 `makoo` prop 接收当前任务的 Context。自定义 Adapter 时，从 `@makoojs/core` 导入下面的挂载协议类型。

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

`host` 是页面中匹配 `injectAt` 的元素，`mountPoint` 是 Makoo 在其中创建的挂载容器。Adapter 将 `artifact` 挂载到 `mountPoint`。

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

卸载时使用挂载阶段返回的 `handle` 释放框架实例。`reason` 表示此次卸载的原因。

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

`taskId` 和 `injectAt` 标识当前组件任务。`destroy()` 卸载并移除任务，`reset()` 释放资源并保留任务记录。

`on()` 订阅 Runtime 中指定名称的事件，`onTask()` 只订阅当前任务的事件；两者都返回取消订阅函数。`controlListener()` 和 `bindListenerSignal()` 用于控制通过 `options.on` 随组件注册的监听器。
