# Local Development

Development runs in two places: Vite runs in your terminal, and the browser script manager loads the development script on matching pages.

## Start the server

```sh
pnpm dev
```

Configure `"dev": "makoo dev"` in your project. You can also call the CLI directly with `pnpm exec makoo dev --port 5174`. Omitted options retain project configuration. See [CLI Commands](../api/cli.md).

## Enable task inspection

Keep your existing `makoo(...)` plugin and add `makooDev()` to the plugin list in `vite.config.ts`:

`vite.config.ts`

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

For React, use `react()` from `@vitejs/plugin-react`.

## Install and connect

1. Open the dev server’s installation entry and confirm development-script installation in your script manager.
2. Open a target page matching `monkey.userscript.match`.
3. After the page executes `createMakoo()`, the terminal with `makooDev()` enabled displays the Runtime connection count.

After changing metadata such as `@match`, check that the manager has the updated development script and reinstall if needed.

## Terminal actions

With `makooDev()` enabled in an interactive terminal, press a key directly; Enter is not required:

| Key | Action |
| --- | --- |
| `i` | Open the development-script installation entry, when available |
| `t` | Toggle tasks and home |
| `n` | View the next Runtime’s tasks |
| `l` | Toggle logs and home |
| `r` | Restart Vite and return home |
| `h` | Open help; press again to return to the previous view |
| `Esc` | Return from help to the previous view; otherwise return home |
| `u` | Return home to view URLs |
| `o` | Use Vite’s browser-opening action |
| `c` | Enter logs and clear the screen |
| `q` / `Ctrl+C` | Stop the server |

The task view shows task ID, kind, status, and target for the selected Runtime. One browser connection can contain multiple Runtimes.

## Logs and restart

Home and task views indicate new development logs. Press `l` to read them. These are Vite and development toolchain logs. Read browser application `console.log` output and Runtime errors in the browser console.

After `r`, task status resumes as pages reconnect. See [Hot Updates](./hmr.md) for update behavior when changing application entries.

## Non-interactive output

When output is redirected or the process runs in CI, connection-count changes and development logs print as plain text. Without `makooDev()`, the CLI uses ordinary Vite development output and shortcuts; follow the terminal’s hints.
