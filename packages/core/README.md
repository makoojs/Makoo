# @makoojs/core

<p>
  <a href="https://www.npmjs.com/package/@makoojs/core"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/core?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/api/core">API Reference</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/core/README.CN.md">中文</a>
</p>

The core package of Makoo, running in the browser. You use it to create a Core instance, declare components and page event listeners, then control them and read their status. Waiting for target elements, mounting, recovery after node replacement, and cleanup all happen here.

It doesn't depend on any frontend framework; components are mounted through the adapters provided by [`@makoojs/vue`](https://www.npmjs.com/package/@makoojs/vue) or [`@makoojs/react`](https://www.npmjs.com/package/@makoojs/react).

## Installation

```sh
pnpm add @makoojs/core
```

> [!TIP]
> Projects created with `pnpm dlx @makoojs/create-makoo` already include it; no separate installation is needed.

## Usage

### Declare Components and Listeners

```ts
import { createMakoo, inject, listen } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());

core.apply([
  inject({
    name: 'panel',
    injectAt: '#sidebar',
    adapter: 'vue',
    component: Panel,
    // remount after the site replaces #sidebar
    reinject: true,
    listeners: [
      // attached listener: starts and stops with panel
      listen({
        name: 'search',
        listenAt: '#search-form',
        type: 'submit',
        callback: () => console.log('Search submitted')
      })
    ]
  }),
  // standalone listener: doesn't belong to any component
  listen({
    name: 'escape',
    listenAt: 'body',
    type: 'keydown',
    callback: (event) => {
      if ((event as KeyboardEvent).key === 'Escape') console.log('Escape pressed');
    }
  })
]);
```

### Control Injections and Read Status

Every injection's command handle and status handle can be obtained by name:

```ts
const panel = core.injection('panel');
const status = panel.statusHandle;

status.subscribe(() => {
  console.log(status.getSnapshot(), status.lastError);
});

await panel.command.stop();
panel.command.start();
```

## Documentation

- [Core Instance](https://makoojs.github.io/Makoo/api/instance): `createMakoo()` and the methods on the instance.
- [Declarations](https://makoojs.github.io/Makoo/api/declarations): all fields of `inject()` and `listen()`.
- [Commands and Status](https://makoojs.github.io/Makoo/api/status): starting, stopping, removing, and what each status value means.
- [Errors and Error Codes](https://makoojs.github.io/Makoo/api/errors): error categories and how to handle them.
