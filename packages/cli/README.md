# @makoojs/cli

<p>
  <a href="https://www.npmjs.com/package/@makoojs/cli"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/cli?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/api/vite">API Reference</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/cli/README.CN.md">中文</a>
</p>

The toolchain package for Makoo. It provides two Vite plugins, `makoo()` and `makooDev()`, the `makoo dev` / `build` / `preview` commands, and `@makoojs/cli/monkey` for calling GM APIs from your script. Userscript metadata, the dev server, and builds are handled by [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).

## Installation

```sh
pnpm add -D @makoojs/cli vite
```

> [!TIP]
> Projects created with `pnpm dlx @makoojs/create-makoo` already have it configured; no separate installation is needed.

## Usage

### Configure Vite

```ts
// vite.config.ts
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
    // optional: view injection status in the dev terminal
    makooDev()
  ]
});
```

### Develop and Build

```sh
makoo dev       # start the dev server; install the dev script from the printed address
makoo build     # build the .user.js
makoo preview   # preview the build output
```

### Call GM APIs

Import by capability in browser code, and the build only generates `@grant` for the APIs you use:

```ts
import { gmStorage } from '@makoojs/cli/monkey';

const runs = gmStorage.get<number>('runs', 0) + 1;
gmStorage.set('runs', runs);
```

## Documentation

- [Vite Plugins](https://makoojs.github.io/Makoo/api/vite): all `makoo()` options, defaults, and `makooDev()`.
- [CLI Commands](https://makoojs.github.io/Makoo/api/cli): options for each command.
- [Userscript API](https://makoojs.github.io/Makoo/api/monkey): the GM APIs exported by `@makoojs/cli/monkey`.
- [Project Configuration](https://makoojs.github.io/Makoo/docs/configuration): configuring match URLs, permissions, and external dependencies.
