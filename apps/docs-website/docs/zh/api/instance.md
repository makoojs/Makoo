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
  injection(name: string): ComponentInjection;
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

1. 检查整批声明：非空数组、每项是组件或监听声明、批内与实例内的名称冲突、附属监听规则、组件选择的适配器是否已注册。
2. 任一项不通过时同步抛出错误，整批都不登记、不启动。
3. 全部通过后登记每一项，此时 `injection()` / `listener()` 已能查到它们；随后按数组顺序启动。

| 情况 | 错误码 |
| --- | --- |
| 参数不是非空数组、某项不是组件或监听、或附属监听设置了 `reinject` | `MAKOO_DECLARATION_INVALID` |
| 名称与批内其他项或实例中已有注入重复 | `MAKOO_INJECTION_NAME_CONFLICT` |
| 组件选择的适配器未注册 | `MAKOO_ADAPTER_NOT_FOUND` |
| 实例已销毁 | `MAKOO_INSTANCE_DISPOSED` |

`apply()` 没有返回值。登记后通过名称取得控制入口，可以多次调用 `apply()` 追加声明。启动之后的等待超时、挂载失败等问题不会从 `apply()` 抛出，而是写入对应注入的 `lastError`，见[错误的分类与处置](../docs/errors.md)。

### `injection()`

按名称取得组件注入。返回对象含 `.command` 与 `.statusHandle`。

```ts
const panel = core.injection('panel');
await panel.command.stop();
panel.command.start();
console.log(panel.statusHandle.getSnapshot()); // 'waiting' | 'mounted' | ...
```

名称不在该 Core Instance 的顶层注入表中时抛出 `MAKOO_INJECTION_NOT_FOUND`。同一次登记的重复查找返回同一对象；注入被移除后，旧对象不会作用到之后登记的同名注入。

### `listener()`

按名称取得独立监听。返回对象含 `.command` 与 `.statusHandle`。

```ts
const clicks = core.listener('page-click');
await clicks.command.stop();
console.log(clicks.statusHandle.getSnapshot()); // 'waiting' | 'bound' | ...
```

名称不在该 Core Instance 的顶层注入表中时抛出 `MAKOO_INJECTION_NOT_FOUND`。与 `injection()` 一样，绑定的是取得时的那一次登记。

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
