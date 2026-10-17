# CLI Commands

`@makoojs/cli` provides the `makoo` command. Inside a project, call it through scripts or `pnpm exec makoo`. For workflows, see [Local Development](../docs/development.md) and [Build and Preview](../docs/build.md).

```sh
makoo dev [root]
makoo build [root]
makoo preview [root]
```

`[root]` is the optional Vite project directory; when omitted, the current working directory is used. For how the Makoo plugin resolves its own relative entry, see [Project Configuration](../docs/configuration.md).

Options that aren't passed don't override the project configuration; explicitly passed options take precedence. To turn off a boolean option, use `--no-...`; when the same option is passed more than once, the last value wins.

## Common Options

| Option | Purpose |
| --- | --- |
| `-c, --config <file>` | Specify the Vite config file |
| `-m, --mode <mode>` | Set the mode |
| `--base <path>` | Set the public base path |
| `-l, --logLevel <level>` | info / warn / error / silent |
| `--clearScreen / --no-clearScreen` | Allow or prevent Vite from clearing the screen |
| `--configLoader <loader>` | How the config is loaded; supported values depend on the installed Vite version |
| `-h, --help` | Show help |
| `-v, --version` | Show the version |

## `makoo dev`

Starts the dev server. The following network options are written to Vite's `server` config.

| Option | Purpose |
| --- | --- |
| `--host [host]` | Listen on the given address; without a value, listen on all addresses |
| `--port <port>` | Set the port |
| `--open [path] / --no-open` | Open a browser path on startup, or disable opening |
| `--strictPort / --no-strictPort` | Whether to exit immediately when the port is in use |
| `--cors / --no-cors` | Control CORS; always enabled in Makoo projects, see [Settings Determined by vite-plugin-monkey](./vite.md#settings-determined-by-vite-plugin-monkey) |
| `--force` | Ignore the dependency pre-bundling cache |

```sh
pnpm exec makoo dev --port 5174 --no-open
```

## `makoo build`

Runs a Vite build. The following options are written to the `build` config.

| Option | Purpose |
| --- | --- |
| `--target <target>` | Build syntax target |
| `--outDir <dir>` | Output directory |
| `--assetsDir <dir>` | Assets directory; no effect in Makoo projects |
| `--assetsInlineLimit <number>` | Asset inlining threshold in bytes; no effect in Makoo projects |
| `--sourcemap [output]` | true / false / inline / hidden; no effect in Makoo projects |
| `--minify [minifier] / --no-minify` | Configure JS minification; Makoo projects don't minify JS by default, use `--minify` to enable it |
| `--manifest [name]` | Generate a build manifest, optionally with a file name |
| `--emptyOutDir / --no-emptyOutDir` | Control whether the output directory is emptied on build |
| `-w, --watch` | Watch the source and rebuild |

Options marked "no effect" are overridden by vite-plugin-monkey; see [Settings Determined by vite-plugin-monkey](./vite.md#settings-determined-by-vite-plugin-monkey).

```sh
pnpm exec makoo build --mode staging --outDir release --minify
```

## `makoo preview`

Starts a preview server for existing output, without building.

| Option | Purpose |
| --- | --- |
| `--host [host]` | Listen on the given address; without a value, listen on all addresses |
| `--port <port>` | Set the port |
| `--open [path] / --no-open` | Open a browser path on startup, or disable opening |
| `--strictPort / --no-strictPort` | Whether to exit immediately when the port is in use |
| `--outDir <dir>` | The build directory to preview |

Network options are written to `preview`, and `--outDir` is written to `build.outDir`.

```sh
pnpm exec makoo preview --outDir release --port 4174
```

## Related APIs

- <span id="makoo">[Vite plugins](./vite.md#makoo)</span>: `makoo()` and `makooDev()`; <span id="cdn">[CDN configuration](./vite.md#cdn)</span>.
- <span id="configuration-types">Configuration types</span>: <span id="makoooptions">[MakooOptions](./vite.md#makoooptions)</span>, <span id="cliconfig">[CliConfig](./vite.md#cliconfig)</span>, <span id="appconfig">[AppConfig](./vite.md#appconfig)</span>, <span id="monkeyconfig">[MonkeyConfig](./vite.md#monkeyconfig)</span>, <span id="monkeyserverconfig">[MonkeyServerConfig](./vite.md#monkeyserverconfig)</span>, <span id="monkeybuildconfig">[MonkeyBuildConfig](./vite.md#monkeybuildconfig)</span>.
- <span id="gm-api">[Userscript API](./monkey.md)</span> and <span id="gm-types">[GM types](./monkey.md#gm-types)</span>.
