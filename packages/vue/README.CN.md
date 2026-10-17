# @makoojs/vue

<p>
  <a href="https://www.npmjs.com/package/@makoojs/vue"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/vue?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/zh/api/vue">API 参考</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/vue/README.md">English</a>
</p>

Makoo 的 Vue 适配器。它让 [`@makoojs/core`](https://www.npmjs.com/package/@makoojs/core) 能把 Vue 组件挂载到网页上，并提供在组件内读取状态、控制注入的 API。

每次挂载都会创建一个独立的 Vue app。需要 Vue 3.3 及以上。

## 安装

```sh
pnpm add @makoojs/vue @makoojs/core vue
```

> [!TIP]
> 用 `pnpm dlx @makoojs/create-makoo` 创建 Vue 项目时已经装好了它，不需要单独安装。

## 用法

### 注册适配器

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

### 在组件中读取状态与控制注入

```vue
<script setup lang="ts">
import { useMakooComponent } from '@makoojs/vue';

const makoo = useMakooComponent();
const status = makoo.status;
</script>

<template>
  <aside>
    <p>状态：{{ status }}</p>
    <button @click="makoo.stop()">关闭</button>
  </aside>
</template>
```

### 安装 Vue 插件

Pinia、Vue Router 等插件通过 `VuePlugin` 登记，之后每次挂载都会自动安装：

```ts
import { createPinia } from 'pinia';
import { VuePlugin } from '@makoojs/vue';

VuePlugin.use(createPinia());
```

请在 `core.apply()` 之前登记，已经挂载的组件不会补装之后登记的插件。

## 文档

- [Vue API](https://makoojs.github.io/Makoo/zh/api/vue)：`createVueAdapter()`、`useMakooComponent()` 与 `VuePlugin`。
- [挂载组件](https://makoojs.github.io/Makoo/zh/docs/injection)：选择挂载位置、传递 props 与常见写法。
