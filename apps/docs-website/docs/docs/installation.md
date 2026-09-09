# Manual Installation

Use this page to add Makoo to an existing Vite project. For a new project, use the [scaffolder](./getting-started.md). These examples use TypeScript and ESM (`"type": "module"` in `package.json`).

## Install packages

Choose the dependencies for your framework:

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

## Configure Vite

A Vue project configuration:

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

For React, replace the `vue` import and `vue()` with `react()` from `@vitejs/plugin-react`. `makooDev()` enables development Runtime task inspection and can be omitted if you do not need it.

`vite.config.ts` runs in Node. Components and the entry that calls `createMakoo()` run on the target page. Keep `document`, GM APIs, and other browser code in the application entry and its imported modules.

## Add project commands

Add these entries to `scripts` in `package.json`:

```json
{
  "dev": "makoo dev",
  "build": "makoo build",
  "preview": "makoo preview"
}
```

## Create an entry and component

Follow [Component Injection](./injection.md) to create `src/main.ts` and a component. Add Vite’s asset type declarations in `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

Run `pnpm dev`, install the development script from the installation entry, and visit a page matching `@match`. See [Local Development](./development.md) for shortcuts and task inspection.
