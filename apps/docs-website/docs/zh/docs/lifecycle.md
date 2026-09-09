# 生命周期与清理

宿主网页决定目标 DOM 何时出现、何时被替换。Makoo 管理任务的等待、挂载和释放；组件仍需要清理自己创建的资源。

## 等待目标

组件任务默认等待目标 5000 毫秒，`options.timeout` 可设置本次任务的等待时间。超时后可通过 `dom:targetTimeout` 事件定位等待失败的任务。

## 目标被替换时重新注入

当宿主会移除已匹配的目标，并重新创建同一选择器对应的元素时，启用 `alive`：

`src/main.ts`

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const makoo = createMakoo({ adapters: [createVueAdapter()] });
makoo.start([
  inject({
    id: 'panel',
    injectAt: '#toolbar',
    artifact: Panel,
    options: { alive: true, scope: 'global', timeout: 5000 }
  })
]);
```

示例复用[组件注入](./injection.md)中的 `Panel.vue`。目标稳定时可省略这些选项，默认 `alive: false`、`scope: 'local'`。

这里使用 `scope: 'global'`，在整个 document 中等待替换后的目标。节点恢复后，Makoo 会重新挂载组件。

## 重置与销毁

| 操作 | 效果 |
| --- | --- |
| `reset(taskId)` | 释放当前任务资源，保留任务记录 |
| `destroy(taskId)` | 释放资源并移除任务 |
| `disableAlive(taskId)` | 停止 alive 观察，保留当前组件 |
| `enableAlive(taskId)` | 为组件任务启用 alive；根据当前挂载情况观察移除或等待目标 |

需要移除一个功能时，调用 `makoo.destroy(taskId)`。

## 清理当前批次

需要批次控制时，保存 `const tasks = makoo.start(...)` 的返回值。`tasks.destroyAll()` 只清理当前 `start()` 返回的任务；`makoo.destroyAll()` 清理这个 Runtime 中的全部任务。在页面继续运行时移除功能，可按需要清理一个批次或整个 Runtime。开发时的更新行为见[热更新与清理](./hmr.md)。

Makoo 管理的挂载点、监听和观察资源随任务释放。组件自行创建的定时器、订阅和事件要在框架卸载钩子中释放。

## 观察生命周期

在 `createMakoo({ hooks: ... })` 注册全局 hooks，或在 `inject()` 的 `options.hooks` 中观察单个任务。例如通过 `artifact:mountFail` 和 `dom:targetTimeout` 区分挂载失败与等待超时。签名和传播规则见[事件与状态](../api/observation.md)。
