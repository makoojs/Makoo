# 错误

Makoo 只使用两个错误类：`MakooError` 和继承它的 `MakooAggregateError`。每个错误都带有错误码 `code`，用于在代码中判断错误种类。错误何时出现、该如何处理，见[错误的分类与处置](../docs/errors.md)。

## `MakooError`

```ts
class MakooError extends Error {
  readonly code: string;
  constructor(message: string, options: { code: string; cause?: unknown });
}
```

| 字段 | 说明 |
| --- | --- |
| `name` | `'MakooError'` |
| `message` | 说明 Makoo 在做什么、对象是谁，例如 `Failed to mount "panel"` |
| `code` | 错误码，见下文 |
| `cause` | 被包装的底层错误，例如适配器或事件处理函数抛出的值。超时、目标失效等 Makoo 自己发现的问题没有 `cause` |

在浏览器控制台中展开错误对象，沿 `cause` 可以找到原始代码位置。

```ts
import { MakooError, MakooErrorCode } from '@makoojs/core';

try {
  core.injection('panel').command.start();
} catch (error) {
  if (error instanceof MakooError && error.code === MakooErrorCode.INJECTION_CLOSED) {
    console.warn('panel 清理失败后已关闭，请刷新页面');
  }
}
```

## `MakooAggregateError`

汇总多个子错误，用于清理失败。

```ts
class MakooAggregateError extends MakooError {
  readonly errors: readonly unknown[];
  constructor(errors: readonly unknown[], message: string, options: { code: string; cause?: unknown });
}
```

- `message` 第一行是汇总说明，之后每个直接子错误占一行。
- `INJECTION_CLEANUP_FAILED` 中，若这次收尾由执行失败引起，该执行错误排在 `errors` 最前，之后是各清理步骤的错误；附属监听的清理错误也并入这里。
- `INSTANCE_CLEANUP_FAILED` 的 `errors` 是各个注入的 `INJECTION_CLEANUP_FAILED`，最多两层。

## `MakooErrorCode`

错误码均为字符串，带有 `MAKOO_` 前缀。比较时请使用常量，例如 `MakooErrorCode.TARGET_WAIT_TIMEOUT`。

### 配置错误

由 `useAdapter()` 或 `apply()` 同步抛出；同一批声明都不会启动。

| 常量 | 含义 |
| --- | --- |
| `DECLARATION_INVALID` | `apply()` 收到空数组、某项不是组件或监听声明，或附属监听设置了 `reinject` |
| `INJECTION_NAME_CONFLICT` | 注入名称重复，或同一组件内附属监听重名 |
| `ADAPTER_NAME_CONFLICT` | 同名适配器已注册 |
| `ADAPTER_NOT_FOUND` | 组件选择的适配器未注册 |

### 控制错误

当前状态或上下文不允许这次调用，同步抛出。

| 常量 | 含义 |
| --- | --- |
| `INJECTION_NOT_FOUND` | 名称不存在；或 `injection()` / `listener()` 查到的 kind 不符 |
| `LISTENER_NOT_FOUND` | 组件中没有这个名称的附属监听 |
| `INJECTION_REMOVED` | 注入已被移除，不能再启动 |
| `INJECTION_CLOSED` | 注入此前清理失败，不能再启动 |
| `INSTANCE_DISPOSED` | Core 实例已销毁 |

### 执行失败

结束一次执行，写入 `lastError`，状态变为 `failed`。清理成功后可以再次 `start()`。

| 常量 | 含义 |
| --- | --- |
| `TARGET_WAIT_TIMEOUT` | 在 `timeout` 内没有找到挂载目标或监听目标 |
| `MOUNT_TARGET_DETACHED` | 挂载目标或组件容器失效，且未开启 `reinject` |
| `MOUNT_FAILED` | 适配器挂载抛错，原始错误在 `cause` 中 |
| `LISTENER_TARGET_DETACHED` | 监听目标离开页面，且不允许恢复 |
| `LISTENER_BIND_FAILED` | 绑定事件时抛错 |
| `ATTACHED_LISTENER_FAILED` | 附属监听失败导致所属组件结束，子错误在 `cause` 中 |

### 清理失败

Core 无法确认资源已经全部释放，注入被关闭（之后的 `start()` 抛出 `INJECTION_CLOSED`）。

| 常量 | 含义 |
| --- | --- |
| `UNMOUNT_FAILED` | 适配器卸载抛错 |
| `CONTAINER_REMOVE_FAILED` | 移除组件容器失败 |
| `LISTENER_UNBIND_FAILED` | 解绑事件失败 |
| `MOUNT_CLEANUP_FAILED` | 适配器契约用：适配器在挂载失败后释放资源也失败时抛出。Core 会把它拆开，`lastError` 中看到的是 `INJECTION_CLEANUP_FAILED`，其中依次为 `MOUNT_FAILED` 和各释放错误 |
| `INJECTION_CLEANUP_FAILED` | 一个注入一次收尾的汇总，`MakooAggregateError` |
| `INSTANCE_CLEANUP_FAILED` | `dispose()` 的汇总，`MakooAggregateError` |

### 回调异常

Makoo 调用的用户代码抛错，只报告，不改变状态。

| 常量 | 含义 |
| --- | --- |
| `LISTENER_CALLBACK_FAILED` | 事件处理函数抛错或返回的 Promise 被拒绝 |
| `STATE_SUBSCRIBER_FAILED` | 状态订阅者抛错 |
| `INSTANCE_OBSERVER_FAILED` | `observe()` 回调抛错 |

### 适配器错误码

| 常量 | 包 | 含义 |
| --- | --- | --- |
| `VueErrorCode.VUE_HOOK_OUTSIDE_COMPONENT` | `@makoojs/vue` | 调用 `useMakooComponent()` 时取不到 Makoo 的注入上下文：不在 Makoo 挂载的 Vue app 中，或不在 `setup` 中同步调用（例如在事件处理函数、`setTimeout` 里） |
| `VueErrorCode.VUE_HOOK_OUTSIDE_SCOPE` | `@makoojs/vue` | 能取到注入上下文，但没有 effect scope，例如在插件里通过 `app.runWithContext()` 调用 |
| `VueErrorCode.VUE_PARTIAL_MOUNT_UNCONFIRMED` | `@makoojs/vue` | Vue 挂载中途失败，无法确认清理完成；注入随之关闭 |
| `ReactErrorCode.REACT_HOOK_OUTSIDE_COMPONENT` | `@makoojs/react` | 在 Makoo 挂载的 React 组件之外调用 Makoo hooks |
