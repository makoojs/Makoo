# @makoojs/vue

`@makoojs/vue` 是 Makoo 的 Vue 挂载适配器。它把 Vue 组件接入 `@makoojs/core` 的 adapter 协议，让 `Injector` 可以在目标 DOM 出现后创建 Vue app、挂载组件，并在任务销毁或重置时正确卸载。

普通 Makoo 项目通常通过 `@makoojs/cli` 使用这个包：当 manifest 中的模块被识别为 Vue 时，CLI 会在生成的虚拟入口中引入 Vue adapter。只有在你直接使用 `@makoojs/core` 手动搭建运行时时，才需要显式调用 `createVueAdapter()`。

## 适用场景

- 在 Makoo 项目中注入 Vue 组件。
- 让 `@makoojs/core` 的 `Injector` 能识别并挂载 Vue artifact。
- 直接使用 core runtime 时手动注册 Vue adapter。
- 在 Vue 组件中读取 Makoo 传入的任务上下文 `makoo`。
- 给 Makoo 创建的 Vue app 注册共享插件。

## 安装

```bash
// npm install @makoojs/vue 
// yarn add @makoojs/vue 
pnpm add @makoojs/vue 
```

`@makoojs/vue` 依赖 `@makoojs/core`，并把 `vue` 作为 peer dependency，所以使用该包前需要安装好`vue`

## 在 CLI 项目中使用

多数情况下，只需要在 manifest 中声明 Vue 组件即可。

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/App.vue',
			framework: 'Vue'
		}
	}
});
```

如果 `framework` 省略或设置为 `auto`，Makoo 会根据 `.vue` 扩展名推断为 Vue。

## Vue 组件中的 Makoo 上下文

Vue adapter 会把 `makoo` 作为根组件 props 传入。组件可以通过它读取当前任务 ID、目标选择器、logger，或控制当前任务生命周期。

```vue
<script setup lang="ts">
import type { VueMountProps } from '@makoojs/vue';

const props = defineProps<VueMountProps>();

function handleClick() {
	props.makoo.getLogger().info(`clicked ${props.makoo.taskId}`);
}
</script>

<template>
	<button type="button" @click="handleClick">Makoo Panel</button>
</template>
```

`makoo` 来自 `@makoojs/core` 的 `MakooContext`，常用能力包括：

| 能力 | 说明 |
| --- | --- |
| `taskId` | 当前注入任务 ID |
| `injectAt` | 当前任务的目标选择器 |
| `enableAlive()` / `disableAlive()` | 控制当前任务的 alive 重注入 |
| `reset()` / `destroy()` | 重置或销毁当前任务 |
| `on()` / `onTask()` | 监听生命周期观察事件 |
| `getLogger()` | 获取当前 injector 的 logger |

## 直接配合 @makoojs/core 使用

如果你不经过 `@makoojs/cli`，可以手动把 Vue adapter 注册到 `Injector`。

```ts
import { Injector } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const injector = new Injector({
	alive: true,
	scope: 'local',
	timeout: 5000
}).applyAdapter(createVueAdapter());

injector.register('#app', Panel);
injector.run();
```

`createVueAdapter()` 返回的 adapter 会：

- 使用 `createApp(artifact, { makoo })` 创建 Vue app。
- 自动应用通过 `VuePlugin` 注册的共享插件。
- 使用 `app.mount(mountPoint)` 挂载组件。
- 在 unmount 时调用 `app.unmount()`。
- 将 mount/unmount 错误包装成 `VueAdapterError`。

## 注册 Vue 插件

`VuePlugin` 用来给 Makoo 创建的每个 Vue app 注册共享插件，例如 router、i18n 或 UI 库插件。

在 CLI 项目中，推荐把插件注册放到 `runtime.setup` 指向的 setup 文件中。这样 setup 文件会先进入 Makoo 生成的虚拟入口，随后 Vue adapter 在挂载每个 Vue 组件时会读取这些插件，并依次执行 `app.use(plugin)`。

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		...makoo({
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			runtime: {
				setup: './injections/vue-setup.ts'
			},
			monkey: {
				userscript: {
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

```ts
// injections/vue-setup.ts
import { VuePlugin } from '@makoojs/vue';
import router from './router';
import i18n from './i18n';

VuePlugin.use(router);
VuePlugin.usePlugins(i18n);
```

也可以一次注册多个插件：

```ts
VuePlugin.usePlugins(router, i18n);
```

以 Pinia 为例：

```ts
// injections/vue-setup.ts
import { VuePlugin } from '@makoojs/vue';
import { createPinia } from 'pinia';

const pinia = createPinia();

VuePlugin.usePlugins(pinia);
```

`VuePlugin` 会去重同一个插件实例。测试或特殊运行时中可以调用 `VuePlugin.clear()` 清空已注册插件。

setup 文件中应当从 `@makoojs/vue` 导入 `VuePlugin`，不要从源码路径或别名导入。否则可能出现 setup 注册到一个 `VuePlugin` 实例，而 Vue adapter 从另一个实例读取插件，导致插件没有真正安装到组件所在的 Vue app。

## 类型导出

`@makoojs/vue` 导出以下常用类型：

| 类型 | 说明 |
| --- | --- |
| `VueMountProps` | Vue 根组件接收到的 props，包含 `makoo` |
| `VueMountArtifact` | Makoo 可识别的 Vue artifact 类型 |
| `VueMountHandle` | Vue app handle 类型 |
| `VueMountInstance` | Vue 组件实例类型 |

也会导出：

- `createVueAdapter`
- `VuePlugin`
- `VueAdapterError`

完整 API 参考后续会放到独立文档站中。

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoojs/vue` | Vue 挂载适配器与 Vue 插件注册辅助 |
| `@makoojs/core` | 提供 `Injector`、adapter 协议和 Makoo runtime context |
| `@makoojs/cli` | 扫描 manifest、生成虚拟入口，并在需要时引入 Vue adapter |

`@makoojs/vue` 本身不是完整运行时。它需要配合 `@makoojs/core` 的注入调度能力，或通过 `@makoojs/cli` 自动生成的运行时代码来工作。
