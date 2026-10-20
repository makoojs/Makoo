# 声明

本页 API 从 `@makoojs/core` 导入。`inject()` 和 `listen()` 只生成声明对象，不访问 DOM、不注册也不启动；声明交给 [`core.apply()`](./instance.md#apply) 后才会校验和运行。

## `inject()`

声明一个组件：把框架组件挂载到宿主页面的某个元素中。

```ts
function inject<TComponent = unknown, TProps = unknown>(
  input: MakooComponentInput<TComponent, TProps>
): MakooComponentDeclaration<TComponent, TProps>;
```

```ts
import { inject, listen } from '@makoojs/core';
import Toolbar from './Toolbar.vue';

const toolbar = inject({
  name: 'toolbar',
  injectAt: '#header',
  adapter: 'vue',
  component: Toolbar,
  props: { compact: true },
  timeout: 30000,
  reinject: true,
  listeners: [
    listen({ name: 'search-submit', listenAt: '#search', type: 'submit', callback: onSubmit })
  ]
});
```

### `MakooComponentInput`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 必填 | 注入名称，在同一 Core 实例的顶层注入中唯一 |
| `injectAt` | `string` | 必填 | 挂载目标的 CSS 选择器 |
| `adapter` | `string` | 必填 | 已注册适配器的名称，例如 `'vue'`、`'react'` |
| `component` | `TComponent` | 必填 | 要挂载的框架组件 |
| `props` | `TProps` | `undefined` | 原样传给根组件的 props |
| `timeout` | `number` | `15000` | 每次查找挂载目标的等待预算，单位毫秒 |
| `reinject` | `boolean` | `false` | 挂载目标或组件容器失效后是否重新查找并挂载；同时决定附属监听能否局部恢复 |
| `listeners` | `listen()` 声明数组 | `[]` | 附属监听，随组件一起启动和停止 |

### 字段约束

- 附属监听的名称在所属组件内唯一，可以与顶层注入同名。
- 附属监听不能设置 `reinject`，它沿用组件的 `reinject`。

附属监听设置了 `reinject` 时，`apply()` 抛出 `MAKOO_DECLARATION_INVALID`；附属监听重名时抛出 `MAKOO_INJECTION_NAME_CONFLICT`。

### 挂载位置

Core 找到第一个匹配 `injectAt` 的元素作为挂载目标，在其末尾追加一个 `div` 作为组件容器，组件挂载在这个容器中。组件停止时，Core 卸载组件并移除容器，不改动挂载目标原有的内容。

`props` 不会被 Makoo 复制或冻结。Vue 会浅拷贝根 props，要让组件感知外部修改，把 `reactive()` 或 `ref()` 作为 `props` 的某个属性传入，例如 `props: { state }`。

## `listen()`

声明一个宿主监听：在宿主页面的某个元素上绑定原生事件。

```ts
function listen(input: MakooListenerInput): MakooListenerDeclaration;
```

```ts
import { listen } from '@makoojs/core';

const escape = listen({
  name: 'escape',
  listenAt: 'body',
  type: 'keydown',
  capture: true,
  callback(event) {
    if (event instanceof KeyboardEvent && event.key === 'Escape') console.log('Escape');
  }
});
```

把返回值直接放进 `apply()` 就是独立监听；放进 `inject()` 的 `listeners` 就是附属监听。

### `MakooListenerInput`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 必填 | 注入名称；附属监听只在所属组件内唯一 |
| `listenAt` | `string` | 必填 | 监听目标的 CSS 选择器 |
| `type` | `string` | 必填 | 事件类型，例如 `'click'` |
| `callback` | `(this: Element, event: Event) => unknown` | 必填 | 事件处理函数 |
| `capture` | `boolean` | `false` | 是否在捕获阶段触发 |
| `timeout` | `number` | `15000` | 每次查找监听目标的等待预算，单位毫秒 |
| `reinject` | `boolean` | `false` | 监听目标失效后是否重新查找并绑定；仅独立监听可设置 |

### 事件处理函数

- 监听绑定在第一个匹配 `listenAt` 的元素上。`this` 是这个元素，`event` 是原生事件对象。
- 回调同步抛错，或返回的 Promise 被拒绝时，Core 打印一个 `MAKOO_LISTENER_CALLBACK_FAILED` 错误，监听保持绑定。独立监听还会把这个错误写入 `lastError`。
- 回调使用普通 `function` 写法时才能通过 `this` 读取监听目标；箭头函数请使用 `event.currentTarget`。

## 声明类型

```ts
type MakooComponentDeclaration<TComponent = unknown, TProps = unknown> = Readonly<
  MakooComponentInput<TComponent, TProps> & { kind: 'component' }
>;

type MakooListenerDeclaration = Readonly<MakooListenerInput & { kind: 'listener' }>;
```

### `MakooInjectionDeclaration`

`apply()` 接收的数组元素类型：

```ts
type MakooInjectionDeclaration = MakooListenerDeclaration | MakooComponentDeclaration;
```

声明在 `apply()` 时固定，之后修改原对象不会影响已登记的注入。要改变选择器、超时等配置，先 `remove()` 再用新声明 `apply()`。
