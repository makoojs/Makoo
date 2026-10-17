# Add Makoo to an Existing Project

This page is for when you already have a Vite project and want to add Makoo. For new projects, use the scaffold in [Quick Start](./getting-started.md) directly.

Prerequisites: the project uses ESM (`"type": "module"` in `package.json`), and Node.js is 20.x at 20.19 or later, or 22.12 or later (21.x is not supported).

Version requirements: `vite` 8.x at 8.2.2 or later, `vue` 3.3 or later, `react` and `react-dom` 19 or later.

## 1. Install Dependencies

::: code-group
```sh [Vue]
pnpm add @makoojs/core @makoojs/vue vue
pnpm add -D @makoojs/cli vite @vitejs/plugin-vue typescript
```
```sh [React]
pnpm add @makoojs/core @makoojs/react react react-dom
pnpm add -D @makoojs/cli vite @vitejs/plugin-react typescript @types/react @types/react-dom
```
:::

## 2. Configure Vite

Add `makoo()` to `vite.config.ts`. Below is the configuration for a Vue project; for React projects, replace `vue()` with `react()` from `@vitejs/plugin-react`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { makoo, makooDev } from '@makoojs/cli';

export default defineConfig({
  plugins: [
    vue(),
    makoo({
      entry: './src/main.ts',
      app: { name: 'my-script', version: '0.0.1' },
      monkey: { userscript: { match: ['https://example.com/*'] } }
    }),
    makooDev()
  ]
});
```

`makooDev()` is optional and lets you view injection status in the development terminal; see [Local Development](./development.md). For field descriptions, see [Project Configuration](./configuration.md).

`vite.config.ts` runs in Node. Browser code such as `document` and GM APIs can only be written in the entry and the modules it imports.

## 3. Add Project Scripts

Add the following to `scripts` in `package.json`:

```json
{
  "dev": "makoo dev",
  "build": "makoo build",
  "preview": "makoo preview"
}
```

## 4. Write the Entry

Create `src/main.ts`:

::: code-group
```ts [Vue]
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './App.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({ name: 'app', injectAt: 'body', adapter: 'vue', component: App })
]);
```
```ts [React]
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import App from './App';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'app', injectAt: 'body', adapter: 'react', component: App })
]);
```
:::

TypeScript projects also need to reference Vite's type declarations in a declaration file included by `tsconfig` (for example `src/vite-env.d.ts`), so that assets such as images can be imported:

```ts
/// <reference types="vite/client" />
```

## 5. Run

```sh
pnpm dev
```

Install the development script from the address the terminal prints, then open a page that matches `@match`; the component should appear on the page. If it doesn't, go through [Troubleshooting](./troubleshooting.md) step by step.
