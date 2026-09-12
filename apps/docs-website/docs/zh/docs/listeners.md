# 事件监听

`listen()` 将 DOM 事件监听交给 Makoo 管理。下面的入口在每次点击页面时打印点击目标。

## 声明监听器

`src/main.ts`

```ts
import { createMakoo, listen } from '@makoojs/core';

const tasks = createMakoo().start([
  listen({
    id: 'page-click',
    listenAt: 'body',
    type: 'click',
    callback: (event) => console.log('Clicked:', event.target)
  })
]);
```

`listenAt` 是目标元素的 CSS 选择器，`type` 是事件名称，`callback` 接收原生 DOM 事件。运行开发脚本后，点击页面并查看浏览器控制台。

## 开关与销毁

`start()` 返回的 `tasks` 可以按 ID 取回监听器。需要暂停页面点击日志时调用 `close()`：

```ts
const task = tasks.get('page-click');
if (task?.kind === 'listener') {
  task.close();
}
```

| 方法 | 用途 |
| --- | --- |
| `close()` | 暂停监听，保留任务 |
| `open()` | 恢复监听 |
| `destroy()` | 移除监听器和任务 |

`open()` 和 `close()` 返回是否成功改变状态。完整类型见[任务句柄](../api/runtime.md#startedtasks)。

## 用状态控制监听

当监听开关需要跟随应用状态时，通过 `activitySignal` 传入状态源。下面用 Escape 键切换点击监听：

`src/main.ts`

```ts
import { createActivityStore, createMakoo, listen } from '@makoojs/core';

const enabled = createActivityStore(true);

createMakoo().start([
  listen({
    id: 'page-click',
    listenAt: 'body',
    type: 'click',
    callback: (event) => console.log('Clicked:', event.target),
    activitySignal: () => enabled
  }),
  listen({
    id: 'toggle-clicks',
    listenAt: 'body',
    type: 'keydown',
    callback: (event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        enabled.update((value) => !value);
        console.log('Click listener enabled:', enabled.get());
      }
    }
  })
]);
```

`enabled` 为 `true` 时启用点击监听，为 `false` 时暂停。`activitySignal` 返回的对象提供 `get()` 读取当前值、`subscribe()` 订阅变化；`createActivityStore()` 已实现这两个方法。

键盘监听保持启用，因此暂停点击监听后仍可以按 Escape 恢复。

## 随组件注册监听

组件任务的 `options.on` 接收一个 `listen()` 声明，使监听器与组件任务一起注册和清理。组件内可通过 `makoo.controlListener('OPEN')` 或 `makoo.controlListener('CLOSE')` 控制它。见 [MakooContext](../api/adapters.md#makoocontext)。
