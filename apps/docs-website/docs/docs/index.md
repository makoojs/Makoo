# Makoo Documentation

Makoo is a framework for developing userscripts. You write components in Vue or React, then declare where on the page they mount and which page events they listen to. Makoo waits for elements to appear, mounts components, binds events, and cleans up completely when the page replaces nodes or a feature stops. The development server and userscript build are provided by Vite and `vite-plugin-monkey`.

Tampermonkey, Violentmonkey, and ScriptCat are supported. You need to know JavaScript, CSS selectors, and how to write components in your chosen framework.

## Start Here

If this is your first time, complete the two tutorials in order:

1. [Quick Start](./getting-started.md): create a project, install the development script, and see your first component on a page.
2. [Tutorial: A Toggleable Tool Panel](./tutorial.md): build a panel that listens to a page element and can be closed and reopened.

If you already have a Vite project, see [Add Makoo to an Existing Project](./installation.md).

## Read as Needed

| You want to | Read |
| --- | --- |
| Complete a specific task | How-to guides: [Mount Components](./injection.md), [Listen to Page Events](./listeners.md), [Control Injections and Read Status](./control.md), [Handle Node Replacement](./reinject.md) |
| Configure, debug, and release | [Project Configuration](./configuration.md), [Local Development](./development.md), [Build and Preview](./build.md), [Troubleshooting](./troubleshooting.md) |
| Understand why it works this way | [Core Concepts](./concepts.md), [Injection Lifecycle](./lifecycle.md), [Error Categories and Handling](./errors.md), [Hot Updates](./hmr.md) |
| Look up parameters, return values, and types | [API Reference](../api/core.md) |

## When to Use It

When a userscript places components in several locations, listens to events on site elements, and has to deal with asynchronously loaded DOM, node replacement in single-page apps, and resource release, Makoo manages all of this in one place.

If you only change an element once when the page loads, the native DOM API is usually enough.

## Package Roles

| Package | Runs in | Purpose |
| --- | --- | --- |
| `@makoojs/core` | Browser | Create Core instances, declare components and listeners, control and read status |
| `@makoojs/vue` / `@makoojs/react` | Browser | Framework adapters and the APIs used inside components |
| `@makoojs/cli` | Node | The `makoo()` and `makooDev()` Vite plugins and the `dev` / `build` / `preview` commands |
| `@makoojs/cli/monkey` | Browser | Call the script manager's GM APIs |
| `@makoojs/create-makoo` | Node | Create new projects |
