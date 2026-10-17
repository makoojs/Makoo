# 控制注入与读取状态

本页说明如何启动、停止、移除一个注入，以及如何在组件内外读取它的状态。每个顶层注入都有命令入口（`start` / `stop` / `remove`）和状态入口（状态与 `lastError`），概念见[核心概念](./concepts.md#命令入口与状态入口)。

## 在组件外控制

用注入名称从 Core 实例取得入口：

```ts
const panel = core.command('panel');
const panelStatus = core.statusHandle('panel');

await panel.stop();               // 卸载组件，保留登记
panel.start();                    // 重新查找挂载目标并挂载
console.log(panelStatus.getSnapshot());
```

入口可以在任何能访问 `core` 的模块中取得，不需要从 `apply()` 处传递。名称不存在时抛出 `MAKOO_INJECTION_NOT_FOUND`。

### 例：用脚本管理器菜单开关面板

```ts
import { gmMenu } from '@makoojs/cli/monkey';

gmMenu.register('显示 / 隐藏面板', () => {
  const status = core.statusHandle('panel').getSnapshot();
  if (status === 'idle') core.command('panel').start();
  else void core.command('panel').stop();
});
```

## 在组件内控制自己

组件可以取得所属注入的命令入口，例如做一个关闭按钮：

::: code-group
```vue [Vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
</script>

<template>
  <button @click="makoo.stop()">关闭</button>
</template>
```
```tsx [React]
import { useComponentCommand } from '@makoojs/react';

export default function Panel() {
  const { stop } = useComponentCommand();
  return <button onClick={() => stop()}>关闭</button>;
}
```
:::

组件停止自己后就被卸载了，无法再自己启动。需要重新打开时，由组件外的代码（例如上面的菜单）调用 `start()`。

`stop()` 和 `remove()` 的区别：

| 操作 | 之后 |
| --- | --- |
| `stop()` | 保留登记，可以再次 `start()` |
| `remove()` | 注销，名称释放；原入口永久失效 |

## 在组件内显示状态

::: code-group
```vue [Vue]
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const status = makoo.status;
const button = makoo.attachedListener('site-button');
</script>

<template>
  <p>组件：{{ status }}，网站按钮：{{ button }}</p>
</template>
```
```tsx [React]
import { useAttachedListenerStatus, useComponentStatus } from '@makoojs/react';

export default function Panel() {
  const status = useComponentStatus();
  const button = useAttachedListenerStatus('site-button');
  return <p>组件：{status}，网站按钮：{button}</p>;
}
```
:::

Vue 返回只读 ref，赋给 `<script setup>` 顶层变量后在模板中自动解包；React hooks 返回状态字符串。订阅在组件卸载时自动释放。

React 组件只需要部分信息时，传入选择器可以减少渲染：

```ts
const ready = useAttachedListenerStatus('site-button', (status) => status === 'bound');
```

## 在组件外订阅状态

```ts
const status = core.statusHandle('panel');
const unsubscribe = status.subscribe(() => {
  if (status.getSnapshot() === 'failed') console.warn('panel 失败：', status.lastError);
});
```

`subscribe()` 的回调不接收参数，请在回调中调用 `getSnapshot()`。不再需要时调用返回的 `unsubscribe()`。

组件的状态入口还能读取附属监听的状态。`core.statusHandle()` 返回组件与独立监听状态入口的联合类型，先用 `in` 判断：

```ts
if ('attachedListenerNames' in status) {
  for (const name of status.attachedListenerNames) {
    console.log(name, status.attachedListener(name).getSnapshot());
  }
}
```

## 等待停止完成

`stop()` 和 `remove()` 返回 Promise，在清理完成后兑现。需要确认资源已释放再继续时，`await` 它们：

```ts
try {
  await core.command('panel').remove();
} catch (error) {
  // 清理失败：error 是 MakooAggregateError，注入已被关闭
  console.error(error);
}
```

只是发出停止请求、不关心结果时，用 `void core.command('panel').stop()` 即可，清理失败仍会打印到控制台。

## 换一份配置

声明在 `apply()` 时固定。要修改选择器、超时、props 对象等配置，先移除再重新声明：

```ts
await core.command('panel').remove();
core.apply([
  inject({ name: 'panel', injectAt: '#new-place', adapter: 'vue', component: Panel })
]);
```

移除前取得的旧入口仍指向旧注入，请重新调用 `core.command('panel')` 取得新入口。

## 销毁整个实例

`core.dispose()` 移除实例中的全部注入，之后实例不再接受新的声明：

```ts
await core.dispose();
```

页面刷新或跳转时，浏览器会连同实例一起清理，通常不需要手动调用。自定义热更新边界时才需要它，见[热更新](./hmr.md#自定义热更新边界)。

## 参考

- [命令与状态 API](../api/status.md)
- [Vue `useMakooComponent()`](../api/vue.md#usemakoocomponent) / [React hooks](../api/react.md#hooks)
