# Runtime 与任务

本页 API 从 `@makoojs/core` 导入。示例中的 `Panel.vue` 使用[组件注入](../docs/injection.md)的面板。

## `createMakoo()`

创建一个 Makoo 运行时。

### 类型 {#type}

```ts
function createMakoo(options?: CreateMakooOptions): MakooRuntime;
```

### 参数 {#parameters}

`options` 使用 `CreateMakooOptions`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `defaults` | `Partial<MakooDefaults>` | `{}` | 设置 injection 的默认选项 |
| `adapters` | `ResolvableMountAdapter[]` | `[]` | 注册可用于挂载 artifact 的 adapter |
| `hooks` | `LifecycleHookMap` | `undefined` | 注册全局生命周期 hooks |
| `logger` | `ILogger` | `new Logger()` | 设置日志实现 |
| `observer` | `ObserverHub` | `createObserverHub(logger)` | 设置生命周期事件中心 |

### 说明 {#details}

`defaults` 的最终默认值：

```json
{
  "alive": false,
  "scope": "local",
  "timeout": 5000
}
```

### 返回值 {#returns}

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

### 示例 {#example}

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

创建 component 任务声明。调用 `inject()` 不会注册或启动任务，返回值需要传给
`MakooRuntime.start()`。

### 类型 {#type-1}

```ts
function inject<TArtifact>(
	input: MakooInjectionInput<TArtifact>
): MakooInjectionDeclaration<TArtifact>;
```

### 参数 {#parameters-1}

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

### 返回值 {#returns-1}

返回 `MakooInjectionDeclaration<TArtifact>`。

### 示例 {#example-1}

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

创建 listener 任务声明。调用 `listen()` 不会注册或启动任务，返回值需要传给
`MakooRuntime.start()`，或者作为 `ArtifactOptions.on` 使用。

### 类型 {#type-2}

```ts
function listen(input: MakooListenerInput): MakooListenerDeclaration;
```

### 参数 {#parameters-2}

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
`capture` 默认为 `false`；设置为 `true` 后，监听器会在 DOM 捕获阶段执行。

### 返回值 {#returns-2}

返回 `MakooListenerDeclaration`。它可以作为独立任务启动，也可以赋给 `ArtifactOptions.on`。

### 示例 {#example-2}

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

监听器句柄的 `open()` / `close()` 返回是否成功改变监听状态；已处于对应状态或无法完成操作时返回 `false`。使用方式见[事件监听](../docs/listeners.md)。

### `InjectionConfig`

```ts
type InjectionConfig = MakooDefaults & {
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
```
