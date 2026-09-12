# Configuration

Configure the dev server and userscript in `vite.config.ts`; configure tasks and components in browser application code. This example uses Vue. React projects use the corresponding `react()` plugin.

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

## Application metadata

`app` is required. `name` and `version` provide the userscript name and version; `description` is optional.

Use `monkey.userscript` for other metadata, such as namespace, matching URLs, permissions, and resources.

## Page matching and task targets

`monkey.userscript.match` determines where the script manager loads the script. For example, `https://example.com/*` matches pages on that site. `injectAt` and `listenAt` are CSS selectors in application code that find elements inside the page.

After changing metadata, confirm that the installed script is updated in your manager. See [Local Development](./development.md).

## Entry and project root

`entry` selects the application entry and accepts an absolute path. Relative paths resolve from the `root` passed to `makoo()`, or the process working directory when omitted.

Vite has its own `root`. When starting a project from another directory, align Makoo entry resolution with the Vite project root. For a configuration file at the project root, obtain that directory with `fileURLToPath(new URL('.', import.meta.url))` and pass it to both Vite and `makoo()`.

The browser entry and its imported modules may use DOM and GM APIs. Do not execute them in configuration loaded by Node.

## Development and build options

| Setting | Location |
| --- | --- |
| Dev port, host, strictPort | Vite `server` |
| Output directory, minification, source maps | Vite `build` |
| Preview port and host | Vite `preview` |
| Script filename, metadata file, external dependencies | `makoo()` → `monkey.build` |
| Development installation entry and script-name prefix | `makoo()` → `monkey.server` |
| Runtime task inspection | Add `makooDev()` separately |

Use CLI options for temporary changes, such as `pnpm exec makoo dev --port 5174`. Omitted options retain project configuration. See [CLI Commands](../api/cli.md).

## External dependencies and permissions

`monkey.build.externalGlobals` configures external dependencies; `cdn` helps generate their URLs.

`autoGrant` defaults to `true`. The build infers the permissions required by GM APIs and writes them to the `.user.js` metadata. See [Userscript APIs](../api/monkey.md).

See the [Vite Plugin Reference](../api/vite.md) for all fields, defaults, and public types.
