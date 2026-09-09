# CLI Commands

`@makoojs/cli` provides the `makoo` command. Use project scripts or `pnpm exec makoo`. See [Local Development](../docs/development.md) and [Build and Preview](../docs/build.md) for workflows.

```sh
makoo dev [root]
makoo build [root]
makoo preview [root]
```

`[root]` is the optional Vite project directory and defaults to the working directory. See [Configuration](../docs/configuration.md) for relative entry resolution in the Makoo plugin.

Omitted options do not override project configuration. Explicit options take precedence. Use `--no-...` to disable boolean flags; repeated options use the last value.

## Common options

| Option | Purpose |
| --- | --- |
| `-c, --config <file>` | Select a Vite configuration file |
| `-m, --mode <mode>` | Set the mode |
| `--base <path>` | Set the public base path |
| `-l, --logLevel <level>` | info / warn / error / silent |
| `--clearScreen / --no-clearScreen` | Allow or disable Vite screen clearing |
| `--configLoader <loader>` | Configuration loader; support depends on the installed Vite version |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## `makoo dev`

Starts the dev server. Networking options map to Vite’s `server` configuration.

| Option | Purpose |
| --- | --- |
| `--host [host]` | Listen on a host; omit the value to listen on all addresses |
| `--port <port>` | Set the port |
| `--open [path] / --no-open` | Open a browser path on startup, or disable opening |
| `--strictPort / --no-strictPort` | Control whether an occupied port causes exit |
| `--cors / --no-cors` | Control CORS |
| `--force` | Ignore the dependency optimizer cache |

```sh
pnpm exec makoo dev --port 5174 --no-open
```

## `makoo build`

Runs a Vite build. These options map to `build`.

| Option | Purpose |
| --- | --- |
| `--target <target>` | Build syntax target |
| `--outDir <dir>` | Output directory |
| `--assetsDir <dir>` | Asset directory |
| `--assetsInlineLimit <number>` | Asset inline threshold in bytes |
| `--sourcemap [output]` | true / false / inline / hidden; no value means true |
| `--minify [minifier] / --no-minify` | Configure minification; supported minifiers depend on Vite |
| `--manifest [name]` | Emit a build manifest, optionally with a filename |
| `--emptyOutDir / --no-emptyOutDir` | Control clearing of the output directory |
| `-w, --watch` | Watch source and rebuild |

```sh
pnpm exec makoo build --mode staging --outDir release --sourcemap --no-minify
```

## `makoo preview`

Serves existing output without running a build.

| Option | Purpose |
| --- | --- |
| `--host [host]` | Listen on a host; omit the value to listen on all addresses |
| `--port <port>` | Set the port |
| `--open [path] / --no-open` | Open a browser path on startup, or disable opening |
| `--strictPort / --no-strictPort` | Control whether an occupied port causes exit |
| `--outDir <dir>` | Build directory to preview |

Networking options map to `preview`; `--outDir` maps to `build.outDir`.

```sh
pnpm exec makoo preview --outDir release --port 4174
```

## Related APIs

- <span id="makoo">[Vite plugins](./vite.md#makoo)</span>: `makoo()` and `makooDev()`; <span id="cdn">[CDN configuration](./vite.md#cdn)</span>.
- <span id="configuration-types">Configuration types</span>: <span id="makoooptions">[MakooOptions](./vite.md#makoooptions)</span>, <span id="cliconfig">[CliConfig](./vite.md#cliconfig)</span>, <span id="appconfig">[AppConfig](./vite.md#appconfig)</span>, <span id="monkeyconfig">[MonkeyConfig](./vite.md#monkeyconfig)</span>, <span id="monkeyserverconfig">[MonkeyServerConfig](./vite.md#monkeyserverconfig)</span>, <span id="monkeybuildconfig">[MonkeyBuildConfig](./vite.md#monkeybuildconfig)</span>.
- <span id="gm-apis">[Userscript APIs](./monkey.md)</span> and <span id="gm-types">[GM types](./monkey.md#gm-types)</span>.
