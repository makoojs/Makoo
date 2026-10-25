# 挂载组件

本页说明如何把一个 Vue 或 React 组件放到宿主网页的指定位置。以已经[接入 Makoo](./installation.md) 的项目为起点。

## 声明组件

在入口中注册适配器，再用 `inject()` 声明组件：

::: code-group
```ts [Vue]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Badge from './Badge.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({ name: 'badge', injectAt: '#header', adapter: 'vue', component: Badge })
]);
```
```ts [React]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Badge from './Badge';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'badge', injectAt: '#header', adapter: 'react', component: Badge })
]);
```
:::

- `name`：注入名称，之后用它控制和查看这个组件。
- `injectAt`：挂载目标的 CSS 选择器。
- `adapter`：适配器名称，与注册的适配器对应。

## 选择挂载位置

1. 在目标网页上打开开发者工具，找到想放组件的元素。
2. 在控制台运行 `document.querySelector('你的选择器')`，确认返回的是这个元素。
3. 把选择器写进 `injectAt`。

Core 使用第一个匹配的元素，在它的**末尾**追加一个 `div` 作为组件容器。要在每个匹配的元素上挂载，见[在每个匹配元素上挂载](#在每个匹配元素上挂载)。想让组件出现在某个元素的最前面或旁边，请选择它的父元素作为挂载目标，再用 CSS 调整位置。

浮动面板这类不依附具体位置的组件，可以挂载到 `body`，并在组件样式中使用 `position: fixed`。

## 传入 props

`props` 会作为根组件的 props 传入：

```ts
inject({
  name: 'badge',
  injectAt: '#header',
  adapter: 'vue',
  component: Badge,
  props: { label: 'Makoo' }
})
```

Vue 组件用 `defineProps<{ label: string }>()` 接收，React 组件从函数参数中读取。

需要从外部更新 Vue 组件时，让 `props` 保持普通对象，把会变化的数据放进其中一个 `reactive()` 属性。Vue 会浅拷贝作为根 props 的 `reactive()` 对象，直接传入它时后续修改不会生效。

```ts
import { reactive } from 'vue';

const state = reactive({ label: '加载中' });
core.apply([
  inject({ name: 'badge', injectAt: '#header', adapter: 'vue', component: Badge, props: { state } })
]);

state.label = '已就绪';
```

组件中声明 `defineProps<{ state: { label: string } }>()`，读取 `state.label`。

## 等待加载较慢的元素

Core 会等待挂载目标出现，默认最多 15 秒。宿主页面加载较慢时，调大 `timeout`（毫秒）：

```ts
inject({ name: 'badge', injectAt: '#comments', adapter: 'vue', component: Badge, timeout: 60000 })
```

超时后组件状态变为 `failed`，`lastError` 的错误码是 `MAKOO_TARGET_WAIT_TIMEOUT`。目标只在用户操作后才出现时，与其设置很长的超时，不如在合适的时机调用 `core.injection('badge').command.start()`，见[控制注入与读取状态](./control.md)。

## 宿主会替换节点时

单页应用切换视图、局部刷新列表时，可能移除挂载目标再创建一个新的。默认情况下组件会随之结束；要让它跟着新元素重新挂载，开启 `reinject`，见[应对节点替换](./reinject.md)。

## 在每个匹配元素上挂载

同一个组件需要放在很多元素上时，例如每条评论作者旁边的徽章，用 `injectEach()` 代替 `inject()` 声明：

::: code-group
```ts [Vue]
import { createMakoo, injectEach } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Badge from './Badge.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  injectEach({ name: 'badges', injectAt: '.comment .author', adapter: 'vue', component: Badge })
]);
```
```ts [React]
import { createMakoo, injectEach } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Badge from './Badge';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  injectEach({ name: 'badges', injectAt: '.comment .author', adapter: 'react', component: Badge })
]);
```
:::

每个匹配的元素都会得到自己的组件，称为子注入。与 `inject()` 相比：

- 当前所有匹配都会按文档顺序挂载。Each 注入运行期间，之后才匹配的元素也会挂载，例如滚动加载出来的评论。
- 没有 `timeout`。暂时一个都没匹配到时，状态保持 `collecting`，Core 继续监视；不会以 `MAKOO_TARGET_WAIT_TIMEOUT` 失败。
- 没有 `reinject`。宿主移除某个元素时，它上面的组件结束；插入新的匹配元素时，会得到新的组件。
- 没有附属监听。需要宿主事件时请使用[独立监听](./listeners.md)。
- 所有组件拿到的是同一个 `props` 对象。

在每个组件内部，`useMakooComponent()` 和 React hooks 指向的都是这一个组件，所以关闭按钮只会关闭它自己的徽章。从外部控制这些组件，见[控制每个子注入](./control.md#控制每个子注入)。

## 同时使用 Vue 和 React

注册两个适配器，各组件分别选择：

```ts
core.useAdapter(createVueAdapter());
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'toolbar', injectAt: '#header', adapter: 'vue', component: Toolbar }),
  inject({ name: 'sidebar', injectAt: '#aside', adapter: 'react', component: Sidebar })
]);
```

## 释放组件自己的资源

Makoo 负责挂载和卸载组件。组件自己创建的定时器、`document` 上的事件、请求、插入到 `body` 的节点，要在 Vue 的 `onUnmounted` 或 React effect 的清理函数中释放：

```ts
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(refresh, 5000);
});
onUnmounted(() => clearInterval(timer));
```

需要监听宿主页面的元素时，优先使用[附属监听](./listeners.md#随组件一起监听)，由 Makoo 负责绑定和解绑。

## 参考

- [`inject()`](../api/declarations.md#inject) / [`injectEach()`](../api/declarations.md#injecteach) 的全部字段
- [Vue API](../api/vue.md) / [React API](../api/react.md)
