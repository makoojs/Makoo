# Core 实例

本页 API 从 `@makoojs/core` 导入。

## `createMakoo()`

创建一个 Core 实例。每个实例拥有自己的适配器注册表、注入名称空间和 DOM 观察；不同实例中的同名注入互不相关。

```ts
function createMakoo(): MakooRuntime;
```

不接收参数。适配器通过 [`useAdapter()`](#useadapter) 注册，组件与监听通过 [`apply()`](#apply) 交给实例。

## `MakooRuntime`

```ts
interface MakooRuntime {
  useAdapter(adapter: MountAdapter): void;
  apply(declarations: readonly MakooInjectionDeclaration[]): void;
  injection(name: string): ComponentInjection | ComponentEachInjection;
  listener(name: string): ListenerInjection;
  observe(handler: ObservationHandler): () => void;
  dispose(): Promise<void>;
}
```

### `useAdapter()`

注册一个组件适配器。组件声明通过 `adapter` 字段按名称选择它。

```ts
core.useAdapter(createVueAdapter());   // 名称为 'vue'
core.useAdapter(createReactAdapter()); // 名称为 'react'
```

| 情况 | 错误码 |
| --- | --- |
| 同名适配器已注册 | `MAKOO_ADAPTER_NAME_CONFLICT` |
| 实例已销毁 | `MAKOO_INSTANCE_DISPOSED` |

已注册的适配器不能替换或注销。

### `apply()`

接收一批声明，校验通过后登记并立即启动。

```ts
core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'vue', component: Panel }),
  listen({ name: 'escape', listenAt: 'body', type: 'keydown', callback: onKeydown })
]);
```

执行顺序：

1. 按以下顺序检查整批声明：参数是否为非空数组；每一项是否为组件、Each 注入或监听声明，其中附属监听是否符合规则（在同一组件内不能重名，不能设置 `reinject`）；名称是否与批内其他项或实例中已有的注入冲突；组件选择的适配器是否已注册。
2. 任一项不通过时同步抛出错误，整批都不登记、不启动。
3. 全部通过后登记每一项，此时 `injection()` / `listener()` 已能查到它们；随后按数组顺序启动。

| 情况 | 错误码 |
| --- | --- |
| 参数不是非空数组，某一项不是组件、Each 注入或监听声明，或附属监听设置了 `reinject` | `MAKOO_DECLARATION_INVALID` |
| 名称与批内其他项或实例中已有注入重复 | `MAKOO_INJECTION_NAME_CONFLICT` |
| 组件选择的适配器未注册 | `MAKOO_ADAPTER_NOT_FOUND` |
| 实例已销毁 | `MAKOO_INSTANCE_DISPOSED` |

`apply()` 没有返回值。登记后通过名称取得控制入口，可以多次调用 `apply()` 追加声明。启动之后的等待超时、挂载失败等问题不会从 `apply()` 抛出，而是写入对应注入的 `lastError`，见[错误的分类与处置](../docs/errors.md)。

### `injection()`

按名称取得组件或 Each 注入。返回的对象包含[命令入口](./status.md#命令入口) `command` 和[状态入口](./status.md#状态入口) `statusHandle`；用 `kind` 区分是哪一种。

```ts
interface ComponentInjection {
  readonly kind: 'component';
  readonly command: ComponentCommand;
  readonly statusHandle: ComponentStatusHandle;
}

interface ComponentEachInjection {
  readonly kind: 'component-each';
  readonly command: ComponentCommand;
  readonly statusHandle: ComponentEachStatusHandle;
  readonly children: readonly ChildInjection[];
}

type ChildInjection = ComponentInjection;
```

```ts
const panel = core.injection('panel');
await panel.command.stop();
panel.command.start();
console.log(panel.statusHandle.getSnapshot()); // 'waiting' | 'mounted' | ...
```

只有某一种才有的成员，例如组件的 `attachedListener()`、Each 注入的 `children`，需要先按 `kind` 收窄：

```ts
const badges = core.injection('badges');
if (badges.kind === 'component-each') {
  for (const child of badges.children) {
    console.log(child.command.name, child.statusHandle.getSnapshot()); // 'badges#1' 'mounted'
  }
}
```

`children` 按元素的文档顺序列出存活的子注入。每次读取都返回一个新数组，数组中的条目在多次读取间是同一个对象。子注入条目的形状与组件注入相同，有自己的 `command` 和 `statusHandle`，没有附属监听。它的 `command.name` 是 `badges#1` 这样的展示名称，不能用 `injection()` 查找。子注入被停止、移除或结束后会离开 `children`：它的 `stop()` 和 `remove()` 仍然兑现，状态入口仍可读取，`start()` 抛出 `MAKOO_INJECTION_REMOVED`。

名称不存在或属于独立监听时抛出 `MAKOO_INJECTION_NOT_FOUND`。对同一个注入重复调用，得到的是同一个对象。这个对象绑定的是取得时的那一个注入：注入被移除后，即使之后登记了同名注入，旧对象也不会作用到新注入上。

### `listener()`

按名称取得独立监听。返回的对象包含命令入口 `command` 和状态入口 `statusHandle`。

```ts
interface ListenerInjection {
  readonly kind: 'listener';
  readonly command: ListenerCommand;
  readonly statusHandle: ListenerStatusHandle;
}
```

```ts
const clicks = core.listener('page-click');
await clicks.command.stop();
console.log(clicks.statusHandle.getSnapshot()); // 'waiting' | 'bound' | ...
```

名称不存在或属于组件时抛出 `MAKOO_INJECTION_NOT_FOUND`。与 `injection()` 一样，返回的对象绑定的是取得时的那一个独立监听。

### `observe()`

订阅实例级的[观察通知](./status.md#实例观察)，返回取消订阅函数。

```ts
const stopObserving = core.observe((notice) => {
  if (notice.type === 'diagnostic') console.warn(notice.name, notice.error);
});
```

- 通知在对应事实生效后同步发出。
- 回调抛错时打印 `MAKOO_INSTANCE_OBSERVER_FAILED`，其他回调照常收到通知。
- 实例已销毁时调用会抛出 `MAKOO_INSTANCE_DISPOSED`；实例销毁完成后会清空全部订阅。
- 组件内拿不到这个方法。单个注入的状态变化请订阅它的状态入口。

### `dispose()`

销毁整个实例：停止并移除全部注入，之后实例不再接受新的适配器、声明和订阅。

```ts
await core.dispose();
```

- 调用后实例立即关闭，随后按登记顺序移除每个注入；某一项清理失败时继续清理其余项。
- 全部完成后发出 `instance-disposed` 通知。
- 有清理失败时，返回的 Promise 以 `MakooAggregateError`（`MAKOO_INSTANCE_CLEANUP_FAILED`）拒绝，`errors` 包含每个注入的清理汇总。
- 重复调用返回同一个 Promise，不会重新尝试失败的清理。
- 移除成功的注入被注销，之后按名称查找会抛出 `MAKOO_INJECTION_NOT_FOUND`。清理失败的注入仍保留登记，可以查到它的入口读取 `lastError`；对它调用 `start()` 会抛出 `MAKOO_INSTANCE_DISPOSED`。

通常不需要调用 `dispose()`：页面刷新或跳转时，旧页面连同实例一起结束。需要它的场景见[热更新](../docs/hmr.md#自定义热更新边界)。
