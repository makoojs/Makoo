# 适配器契约

组件适配器把某个前端框架接入 Core 的挂载与卸载。`@makoojs/vue` 和 `@makoojs/react` 已提供适配器，通常只需注册：

```ts
core.useAdapter(createVueAdapter());
```

本页列出适配器需要满足的契约，供阅读源码或接入其他框架时查阅。类型从 `@makoojs/core` 导入。

## `MountAdapter`

```ts
interface MountAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
  readonly name: string;
  mount(params: AdapterMountParams<TComponent, TProps>): THandle;
  unmount(mountHandle: THandle): void;
}
```

| 成员 | 说明 |
| --- | --- |
| `name` | 适配器名称，组件声明的 `adapter` 字段按它选择；同一实例内唯一 |
| `mount(params)` | 同步把组件挂载到 `params.container`，返回挂载句柄 |
| `unmount(mountHandle)` | 同步卸载 `mount()` 返回的那次挂载 |

Core 只保存挂载句柄，不读取其内容，卸载时原样交回给 `unmount()`。

## `AdapterMountParams`

```ts
interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
  component: TComponent;
  injection: ComponentInjection;
  props: TProps | undefined;
  container: HTMLElement;
  listener(name: string): ListenerInjection;
}
```

| 字段 | 说明 |
| --- | --- |
| `component` | 声明中的 `component` |
| `props` | 声明中的 `props`，未提供时为 `undefined` |
| `container` | Core 为这次挂载创建的组件容器 |
| `injection` | 所属组件注入（含 `command` 与 `statusHandle`），与 `core.injection(name)` 同一对象 |
| `listener(name)` | 查找同一实例中的独立监听，返回 `{ command, statusHandle }` |

`listener(name)` 在名称不存在、名称属于组件或只是附属监听时，抛出 `MAKOO_INJECTION_NOT_FOUND`。

## 行为约定

### 挂载

- `mount()` 正常返回即视为挂载成功。Core 不等待框架首次渲染或副作用完成。
- `mount()` 返回后，若这一轮没有被停止、挂载目标和组件容器仍然有效，Core 才启动附属监听；否则直接卸载这次挂载。

### 挂载失败

- 直接抛出原始错误，Core 会将其包装为 `MAKOO_MOUNT_FAILED`，原始值放在 `cause` 中。
- 抛出前，适配器应释放本次已创建的框架资源。
- 若释放也失败，或无法确认已释放干净，抛出 `MakooAggregateError`，`code` 为 `MakooErrorCode.MOUNT_CLEANUP_FAILED`，`cause` 为原始挂载错误，`errors` 为释放失败的错误。Core 会把它当作清理失败处理并关闭该注入：`lastError` 为 `MAKOO_INJECTION_CLEANUP_FAILED`，其 `errors` 依次是 `MAKOO_MOUNT_FAILED`（`cause` 为原始挂载错误）和适配器给出的各个错误。

### 卸载

- `unmount()` 同步执行。正常返回后 Core 才移除组件容器。
- 抛错时 Core 将其包装为 `MAKOO_UNMOUNT_FAILED`，计入清理失败，并继续尝试移除容器。

### 组件侧能力

把 `injection` 和 `listener` 交给组件的方式由适配器自行决定。Vue 适配器通过 `provide` 交给 [`useMakooComponent()`](./vue.md#usemakoocomponent)，React 适配器通过 Context 交给 [hooks](./react.md#hooks)。组件卸载时，适配器应释放组件内建立的状态订阅。
