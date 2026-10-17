# @makoojs/react

<p>
  <a href="https://www.npmjs.com/package/@makoojs/react"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/react?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/zh/api/react">API 参考</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/react/README.md">English</a>
</p>

Makoo 的 React 适配器。它让 [`@makoojs/core`](https://www.npmjs.com/package/@makoojs/core) 能把 React 组件挂载到网页上，并提供在组件内读取状态、控制注入的 hooks。

每次挂载都会在组件容器上创建一个独立的 React root。需要 React 19 及以上。

## 安装

```sh
pnpm add @makoojs/react @makoojs/core react react-dom
```

> [!TIP]
> 用 `pnpm dlx @makoojs/create-makoo` 创建 React 项目时已经装好了它，不需要单独安装。

## 用法

### 注册适配器

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel';

const core = createMakoo();
core.useAdapter(createReactAdapter());

core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'react', component: Panel })
]);
```

### 在组件中读取状态与控制注入

```tsx
import { useComponentCommand, useComponentStatus } from '@makoojs/react';

export default function Panel() {
  const { stop } = useComponentCommand();
  const status = useComponentStatus();

  return (
    <aside>
      <p>状态：{status}</p>
      <button onClick={() => stop()}>关闭</button>
    </aside>
  );
}
```

`useComponentStatus()` 会订阅状态变化，组件卸载时自动释放。

## 文档

- [React API](https://makoojs.github.io/Makoo/zh/api/react)：`createReactAdapter()` 与全部 hooks。
- [挂载组件](https://makoojs.github.io/Makoo/zh/docs/injection)：选择挂载位置、传递 props 与常见写法。
