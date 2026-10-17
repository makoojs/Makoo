# Project Configuration

This page covers the development server and userscript configuration in `vite.config.ts`. Components and listeners are written in the browser entry; see [Mount Components](./injection.md). Below is a Vue project configuration; React projects use the corresponding `react()` plugin:

`vite.config.ts`

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { makoo, makooDev } from '@makoojs/cli';

export default defineConfig({
  server: { port: 5173 },
  build: { outDir: 'dist' },
  plugins: [
    vue(),
    makoo({
      entry: './src/main.ts',
      app: {
        name: 'my-script',
        version: '0.0.1',
        description: 'Tools for example.com'
      },
      monkey: {
        userscript: {
          namespace: 'npm/makoo',
          match: ['https://example.com/*']
        }
      }
    }),
    makooDev()
  ]
});
```

## App Metadata

`app` is required. `name` and `version` generate the userscript's name and version, and `description` is optional.

`monkey.userscript` configures other metadata such as `namespace`, `match`, permissions, and resources.

## Page Matching and Element Selectors

`monkey.userscript.match` decides which pages the script manager loads the script on. For example, `https://example.com/*` matches pages on that site. `injectAt` and `listenAt` are CSS selectors in the app code used to find elements inside the page.

After changing metadata, confirm that the installation info in the script manager has been updated; see [Local Development](./development.md).

## Entry and Project Directory

`entry` is the app entry and can be an absolute path; relative paths are based on the `root` of `makoo()`, or on the process's current working directory when `root` is omitted.

Vite also has its own `root`. If you start the project from another directory, keep Makoo's entry resolution consistent with Vite's project root. For example, when the config file is in the project root, you can get that directory with `fileURLToPath(new URL('.', import.meta.url))` and pass it to both Vite and `makoo()`.

The browser entry and the modules it imports can use the DOM and GM APIs; don't run them in the config file that Node loads.

## Development and Build Options

| Setting | Where to write it |
| --- | --- |
| Server port, host, strictPort | Vite's `server` |
| Build directory, JS minification | Vite's `build` |
| Preview port, host | Vite's `preview` |
| Script file name, metadata file, external dependencies | `monkey.build` of `makoo()` |
| Whether to open the install page automatically, development script name | `monkey.server` of `makoo()` |
| Injection status in the development terminal | Add `makooDev()` separately |

Source maps, the assets directory, CORS, and similar settings are fixed by vite-plugin-monkey, and changing them in the Vite config has no effect; JS is not minified by default. See [Settings Determined by vite-plugin-monkey](../api/vite.md#settings-determined-by-vite-plugin-monkey).

The development script's name defaults to `server:` plus `app.name`, for example `server:my-script`. Pass a function to `monkey.server.prefix` to customize it; passing a string replaces the whole name. See [Defaults and Field Constraints](../api/vite.md#defaults-and-field-constraints).

For temporary adjustments, use command-line arguments, for example `pnpm exec makoo dev --port 5174`; options you don't pass keep their configured values. See [CLI Commands](../api/cli.md).

## External Dependencies and Permissions

`monkey.build.externalGlobals` can configure dependencies as external script resources, and `cdn` helps generate their URLs. It only takes effect at build time; `pnpm dev` still uses the locally installed dependencies.

`autoGrant` defaults to `true`. At build time, the permissions required by GM APIs are inferred and written into the `.user.js` metadata. The development script, by contrast, always declares `@grant *`, so for GM APIs that work during development, still check `@grant` in the build output after building. For how to use GM, see [Userscript API](../api/monkey.md).

For the full fields, defaults, and public types, see the [Vite Plugin Reference](../api/vite.md).
