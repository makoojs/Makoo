# 命令与状态

每个顶层注入（组件、Each 注入或独立监听）都有两个入口：命令入口负责启动、停止和移除，状态入口负责读取和订阅状态。在组件外，组件和 Each 注入通过 [`core.injection(name)`](./instance.md#injection)、独立监听通过 [`core.listener(name)`](./instance.md#listener) 取得一个对象，它的 `command` 和 `statusHandle` 就是这两个入口；组件内通过 [Vue](./vue.md) 或 [React](./react.md) 的 API 取得同样的入口。

Each 注入 `children` 中的每个子注入也有自己的命令入口和状态入口，形状与组件的相同。附属监听没有自己的命令入口，只能通过所属组件的状态入口读取状态。

## 命令入口

```ts
interface ComponentCommand {
  readonly name: string;
  start(): void;
  stop(): Promise<void>;
  remove(): Promise<void>;
}

interface ListenerCommand {
  readonly name: string;
  start(): void;
  stop(): Promise<void>;
  remove(): Promise<void>;
}

type InjectionCommand = ComponentCommand | ListenerCommand;
```

### `start()`

请求运行这个注入。

- 已在运行时重复调用不会重复执行。
- 上一轮正在清理时，启动请求会被记下，清理成功后再开始；清理失败时这个请求被丢弃。
- 真正开始新一轮执行时，会清除上一次的 `lastError`。整体重注入和局部恢复不会清除它。
- 上一轮执行失败、但清理成功时，可以再次 `start()`。

| 情况 | 错误码 |
| --- | --- |
| 注入已被移除 | `MAKOO_INJECTION_REMOVED` |
| 注入此前清理失败，已被关闭 | `MAKOO_INJECTION_CLOSED` |
| 所属 Core 实例已销毁 | `MAKOO_INSTANCE_DISPOSED` |

### `stop()`

停止当前执行并清理资源，保留登记。之后可以再次 `start()`。

- 停止意图立即生效：正在等待的查找、待恢复的工作会被取消，过期回调不会再挂载或绑定。
- 组件依次停止附属监听、卸载框架组件、移除组件容器。
- 清理完成后 Promise 兑现，状态变为 `idle`。对执行失败（且清理成功）的 `failed` 注入调用时，同样变为 `idle`，`lastError` 保留。
- 清理失败时 Promise 以 `MakooAggregateError`（`MAKOO_INJECTION_CLEANUP_FAILED`）拒绝，状态变为 `failed`，注入被关闭。
- 重复调用等待同一次清理。

### `remove()`

停止并注销这个注入。成功后名称被释放，可以用新声明再次 `apply()` 同名注入。

- 移除后，这个命令入口和状态入口都永久属于旧注入：`start()` 抛出 `MAKOO_INJECTION_REMOVED`，状态停在 `idle`。
- 注销后 Core 实例发出 `injection-removed` 通知。
- 清理失败时 Promise 拒绝，名称保持占用，直到页面刷新。

### Each 注入与子注入

Each 注入使用同样的 `ComponentCommand`，作用于整组：

- `start()` 挂载当前所有匹配并持续收集新的匹配，状态变为 `collecting`。抛出的错误与上文相同。
- `stop()` 停止收集，然后逐个停止存活的子注入；全部清理完成后 Promise 兑现，`children` 变为空。任一子注入清理失败时，Promise 以整组的一个 `MakooAggregateError`（`MAKOO_INJECTION_CLEANUP_FAILED`）拒绝，Each 注入被关闭。
- `remove()` 同上，之后注销 Each 注入。
- 停止后再次 `start()`，会在每个匹配上重新挂载，包括上一轮中子注入被停止或失败的元素。

子注入的命令入口只作用于这一个子注入：

- `stop()` 和 `remove()` 都会卸载它并把它移出 `children`；在 Each 注入的这一轮运行中，它的元素不会再被挂载。两者都不会注销任何东西。
- 子注入还在 `children` 中时，`start()` 不做任何事；离开后 `start()` 抛出 `MAKOO_INJECTION_REMOVED`。新的子注入由 Each 注入自行挂载。
- 子注入清理失败时，它自己的 `stop()` / `remove()` 以 `MAKOO_INJECTION_CLEANUP_FAILED` 拒绝；Each 注入继续运行。

## 状态入口

```ts
interface ComponentStatusHandle extends StateView<ComponentStatus> {
  readonly lastError: MakooError | undefined;
  readonly attachedListenerNames: readonly string[];
  attachedListener(name: string): StateView<ListenerStatus>;
}

interface ComponentEachStatusHandle extends StateView<ComponentEachStatus> {
  readonly lastError: MakooError | undefined;
}

interface ListenerStatusHandle extends StateView<ListenerStatus> {
  readonly lastError: MakooError | undefined;
}

type InjectionStatusHandle =
  | ComponentStatusHandle
  | ComponentEachStatusHandle
  | ListenerStatusHandle;
```

子注入的状态入口是一个 `attachedListenerNames` 为空的 `ComponentStatusHandle`。

| 成员 | 说明 |
| --- | --- |
| `getSnapshot()` | 读取当前状态字符串 |
| `subscribe(notify)` | 状态变化时调用 `notify()`，返回取消订阅函数 |
| `lastError` | 最近一次诊断错误；读取它不会建立订阅 |
| `attachedListenerNames` | 组件声明中附属监听的名称，顺序与声明一致 |
| `attachedListener(name)` | 取得某个附属监听的状态视图；名称不存在时抛出 `MAKOO_LISTENER_NOT_FOUND` |

```ts
const status = core.injection('toolbar').statusHandle;
const unsubscribe = status.subscribe(() => {
  console.log('toolbar:', status.getSnapshot(), status.lastError);
});
```

状态入口在注入存续期间保持不变，整体重注入和局部恢复不会更换它。

### `lastError`

`lastError` 记录以下三种来源中最近的一次：

- 执行失败，例如等待超时、挂载失败、目标失效且不允许恢复。
- 清理失败，值为 `MakooAggregateError`。
- 独立监听的事件处理函数异常（`MAKOO_LISTENER_CALLBACK_FAILED`）。

Each 注入的 `lastError` 只记录整组自身的失败：收集失败，例如 `injectAt` 不是合法的选择器（`MAKOO_MOUNT_FAILED`），或清理失败。子注入的失败记录在这个子注入的状态入口上。

`lastError` 变化本身不会通知订阅者。执行失败和清理失败会在状态变为 `failed` 之前写入，因此在订阅回调中可以读到；回调异常只写入、不改变状态。

两种 `failed` 不能只靠状态字符串区分：`lastError.code` 为 `MAKOO_INJECTION_CLEANUP_FAILED` 时注入已被关闭，其他错误码表示执行失败，可以再次 `start()`。

状态订阅者抛出的异常只打印到控制台，不会写入 `lastError`。错误分类见[错误的分类与处置](../docs/errors.md)。

## 状态值

### `ComponentStatus`

```ts
type ComponentStatus = 'idle' | 'waiting' | 'mounted' | 'failed';
```

| 状态 | 含义 |
| --- | --- |
| `idle` | 未运行：还没启动、已停止或已移除 |
| `waiting` | 正在查找挂载目标或正在挂载；整体重注入期间也处于此状态 |
| `mounted` | 适配器已挂载组件，附属监听已开始查找目标 |
| `failed` | 执行失败或清理失败，原因见 `lastError` |

`mounted` 不代表附属监听都已绑定。初次挂载时附属监听可能仍处于 `waiting`，请分别读取它们的状态。

子注入同样使用 `ComponentStatus`：挂载过程中为 `waiting`，之后为 `mounted`，被停止或移除后为 `idle`，挂载失败或元素离开页面（`MAKOO_MOUNT_TARGET_DETACHED`）时为 `failed`。

### `ComponentEachStatus`

```ts
type ComponentEachStatus = 'idle' | 'collecting' | 'failed';
```

| 状态 | 含义 |
| --- | --- |
| `idle` | 未运行：还没启动、已停止或已移除 |
| `collecting` | 运行中：当前匹配都已挂载子注入，新匹配出现时继续挂载；一个都没匹配到时也处于此状态 |
| `failed` | 整组的收集失败或清理失败，原因见 `lastError` |

子注入停止或失败不会改变 Each 注入的状态。各子注入的状态从 `children` 中读取。

### `ListenerStatus`

```ts
type ListenerStatus = 'idle' | 'waiting' | 'bound' | 'failed';
```

| 状态 | 含义 |
| --- | --- |
| `idle` | 未运行：还没启动、已停止或已移除 |
| `waiting` | 正在查找监听目标；局部恢复期间也处于此状态 |
| `bound` | 事件已绑定在监听目标上 |
| `failed` | 等待超时、绑定失败、目标失效且不允许恢复，或清理失败 |

宿主事件触发不会改变监听状态。点击、播放等业务事件请在事件处理函数中处理。

## `StateView`

状态视图提供快照读取和订阅：

```ts
interface StateView<T> {
  getSnapshot(): Readonly<T>;
  subscribe(notify: () => void): () => void;
}
```

- 状态不变时 `getSnapshot()` 返回同一个值；变化后替换快照并同步通知订阅者。
- `notify` 不接收参数，在回调中调用 `getSnapshot()` 读取新值。
- 某个订阅者抛错时，Core 打印 `MAKOO_STATE_SUBSCRIBER_FAILED` 并发出 `diagnostic` 通知，其他订阅者照常收到通知。

这个形状可以直接交给 React 的 `useSyncExternalStore`。在 Makoo 挂载的组件中，请优先使用 [Vue](./vue.md) 或 [React](./react.md) 提供的封装，它们会自动释放订阅。

## 实例观察

[`core.observe()`](./instance.md#observe) 的回调接收观察通知：

```ts
type ObservationNotice =
  | { type: 'injection-removed'; name: string }
  | { type: 'instance-disposed' }
  | { type: 'diagnostic'; name?: string; error: MakooError };

type ObservationHandler = (notice: ObservationNotice) => void;
```

| 通知 | 何时发出 |
| --- | --- |
| `injection-removed` | 某个顶层注入移除成功并已注销 |
| `instance-disposed` | `dispose()` 处理完全部注入；每个实例只发出一次 |
| `diagnostic` | 出现不改变状态的诊断：状态订阅者异常（带 `name`）或观察回调异常（不带 `name`） |

单个注入的状态变化不会出现在实例观察中，请订阅它的状态入口。
