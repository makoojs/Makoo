# Core API

`@makoojs/core` 在浏览器中运行：创建 Core 实例、声明组件与监听、读取状态和处理错误。第一次使用请先完成[快速开始](../docs/getting-started.md)。

## 导出索引

### 函数

| 导出 | 用途 | 参考 |
| --- | --- | --- |
| `createMakoo()` | 创建 Core 实例 | [Core 实例](./instance.md#createmakoo) |
| `inject()` | 声明组件 | [声明](./declarations.md#inject) |
| `listen()` | 声明宿主监听 | [声明](./declarations.md#listen) |

### 类与常量

| 导出 | 用途 | 参考 |
| --- | --- | --- |
| `MakooError` | Makoo 抛出或报告的错误 | [错误](./errors.md#makooerror) |
| `MakooAggregateError` | 汇总多个子错误 | [错误](./errors.md#makooaggregateerror) |
| `MakooErrorCode` | Core 错误码 | [错误](./errors.md#makooerrorcode) |

### 类型

| 类型 | 参考 |
| --- | --- |
| `MakooRuntime` | [Core 实例](./instance.md#makooruntime) |
| `MakooComponentInput`、`MakooComponentDeclaration` | [声明](./declarations.md#makoocomponentinput) |
| `MakooListenerInput`、`MakooListenerDeclaration` | [声明](./declarations.md#makoolistenerinput) |
| `MakooInjectionDeclaration` | [声明](./declarations.md#makooinjectiondeclaration) |
| `ComponentCommand`、`ListenerCommand`、`InjectionCommand` | [命令与状态](./status.md#命令入口) |
| `ComponentStatusHandle`、`ListenerStatusHandle`、`InjectionStatusHandle` | [命令与状态](./status.md#状态入口) |
| `ComponentStatus`、`ListenerStatus` | [命令与状态](./status.md#状态值) |
| `StateView` | [命令与状态](./status.md#stateview) |
| `ObservationNotice`、`ObservationHandler` | [命令与状态](./status.md#实例观察) |
| `MountAdapter`、`AdapterMountParams` | [适配器契约](./adapters.md) |

## 最小示例

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'vue', component: Panel })
]);
```

Vue 和 React 组件内使用的 API 见 [Vue](./vue.md) 与 [React](./react.md)。
