# Build and Preview

Start with a working Makoo project, produce an installable userscript, and check the build on a real target page.

## Build the script

```sh
pnpm build
```

The project script should run `makoo build`. Vite’s `build.outDir` controls the output directory, normally `dist` when unset. The script filename defaults to `${app.name}.user.js` and can be set through `monkey.build.fileName`.

For example, `app.name: 'my-script'` produces `dist/my-script.user.js`. A `.meta.js` file is produced only when metadata-file generation is configured.

## Check metadata

Open the userscript metadata at the top of the output and verify:

- `@name` and `@version` match your release.
- `@match` includes the intended pages.
- `@grant`, `@connect`, `@require`, and `@resource` match the capabilities you use.

See [Configuration](./configuration.md). Check automatically inferred permissions in the actual output.

## Preview and install

```sh
pnpm preview
```

`makoo preview` serves the build directory; it uses the output from the previous build. Open the printed URL, use the page’s userscript installation entry to install the output, and visit a matching page to verify the feature.

Disable the development script for the same feature in your manager before testing the release script, to avoid duplicate mounts. Release output does not depend on the local dev server.

## Output directories and debug builds

```sh
pnpm exec makoo build --outDir release
pnpm exec makoo preview --outDir release
```

Use the same output directory for build and preview. Editing source without rebuilding leaves preview serving the previous output.

To investigate a build-only issue, disable minification and emit source maps:

```sh
pnpm exec makoo build --sourcemap --no-minify
```

See [CLI Commands](../api/cli.md) for all options.

## Distribution

Provide the built `.user.js` file for users to install. When distributing through a website, users can open the `.user.js` link to install it in their script manager.
