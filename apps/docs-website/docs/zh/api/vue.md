# @makoojs/vue

`@makoojs/vue` 提供 Vue adapter，让 Makoo 能把 Vue 组件挂载到注入任务中。它还提供一个简单的全局 Vue 插件注册器，用于给所有注入的 Vue app 安装插件。

## 导出概览

```ts
import { createVueAdapter, VuePlugin, VueAdapterError } from '@makoojs/vue';
```

类型：

```ts
import type {
	VueMountArtifact,
	VueMountHandle,
	VueMountInstance,
	VueMountProps
} from '@makoojs/vue';
```

## createVueAdapter()

创建 Vue 挂载适配器。

```ts
import { Injector } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const injector = new Injector();

injector.applyAdapter(createVueAdapter());
injector.register('body', Panel);
injector.run();
```

签名：

```ts
function createVueAdapter(): VueMountAdapter;
```

adapter 会：

1. 判断 artifact 是否是 Vue component。
2. 使用 `createApp(artifact, { makoo })` 创建 Vue app。
3. 安装 `VuePlugin` 中已注册的插件。
4. 调用 `app.mount(mountPoint)` 挂载组件。
5. 在 reset、destroy 或 remount 时调用 `app.unmount()`。

## 组件 props

Vue 组件会收到一个 `makoo` prop：

```vue
<script setup lang="ts">
import type { VueMountProps } from '@makoojs/vue';

defineProps<VueMountProps>();
</script>

<template>
	<button @click="makoo.destroy()">Close</button>
</template>
```

类型：

```ts
type VueMountProps = {
	makoo: MakooContext;
};
```

`MakooContext` 来自 `@makoojs/core`，包含当前任务 id、目标选择器、reset/destroy、hooks、logger 和监听器控制方法。

## VuePlugin

`VuePlugin` 是一个模块级插件注册器。`createVueAdapter()` 挂载组件时，会把这里注册的插件安装到每个新创建的 Vue app 上。

```ts
import { VuePlugin } from '@makoojs/vue';
import pinia from './pinia';

VuePlugin.use(pinia);
```

API：

| 方法 | 说明 |
| --- | --- |
| `VuePlugin.use(plugin)` | 注册一个 Vue 插件，重复注册会被忽略 |
| `VuePlugin.usePlugins(...plugins)` | 一次注册多个插件 |
| `VuePlugin.getPlugins()` | 返回当前插件列表副本 |
| `VuePlugin.clear()` | 清空已注册插件 |

示例：

```ts
import { VuePlugin } from '@makoojs/vue';
import router from './router';
import pinia from './pinia';

VuePlugin.usePlugins(router, pinia);
```

如果你在测试中使用 `VuePlugin`，建议在每个用例结束后调用 `VuePlugin.clear()`，避免插件状态泄漏到下一个测试。

## VueMountArtifact

```ts
type VueMountArtifact = Component;
```

也就是说，普通 `.vue` 单文件组件、`defineComponent()` 返回的组件对象，以及 Vue 可识别的组件对象都可以作为 artifact 注册。

```ts
injector.register('#panel', Panel);
```

## VueMountHandle 和 VueMountInstance

```ts
type VueMountHandle = App<Element>;
type VueMountInstance = ComponentPublicInstance;
```

adapter 的 `mount()` 返回：

```ts
{
	handle: app,
	instance
}
```

其中 `handle` 用于卸载，`instance` 是 Vue 挂载后的组件实例。

## Manifest 中使用

通过 `@makoojs/cli` 使用 Vue 组件时，可以显式写 `framework: 'Vue'`：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			framework: 'Vue'
		}
	}
});
```

如果组件扩展名是 `.vue`，Makoo 也可以自动推断 Vue。显式写出 `framework` 会让 manifest 更清楚。

## VueAdapterError

当 Vue adapter 挂载或卸载失败时，会抛出 `VueAdapterError`。

```ts
import { VueAdapterError } from '@makoojs/vue';

try {
	injector.run();
} catch (error) {
	if (error instanceof VueAdapterError) {
		console.error(error.code, error.issues);
	}
}
```

`VueAdapterError` 继承自 `AdapterError`，因此也可以按 `@makoojs/core` 的错误基类统一处理。
