# @makoojs/react

<p>
  <a href="https://www.npmjs.com/package/@makoojs/react"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/react?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/api/react">API Reference</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/react/README.CN.md">中文</a>
</p>

The React adapter for Makoo. It lets [`@makoojs/core`](https://www.npmjs.com/package/@makoojs/core) mount React components onto web pages, and provides hooks for reading status and controlling the injection from inside components.

Each mount creates a separate React root on the component container. Requires React 19 or later.

## Installation

```sh
pnpm add @makoojs/react @makoojs/core react react-dom
```

> [!TIP]
> React projects created with `pnpm dlx @makoojs/create-makoo` already include it; no separate installation is needed.

## Usage

### Register the Adapter

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

### Read Status and Control the Injection in a Component

```tsx
import { useComponentCommand, useComponentStatus } from '@makoojs/react';

export default function Panel() {
  const { stop } = useComponentCommand();
  const status = useComponentStatus();

  return (
    <aside>
      <p>Status: {status}</p>
      <button onClick={() => stop()}>Close</button>
    </aside>
  );
}
```

`useComponentStatus()` subscribes to status changes, and the subscription is released automatically when the component unmounts.

## Documentation

- [React API](https://makoojs.github.io/Makoo/api/react): `createReactAdapter()` and all hooks.
- [Mount Components](https://makoojs.github.io/Makoo/docs/injection): choosing a mount position, passing props, and common patterns.
