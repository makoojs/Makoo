# Makoo Documentation

Makoo runs Vue and React components and event-listener tasks inside existing web pages. It waits for target elements, mounts components, and manages task cleanup. Vite and `vite-plugin-monkey` provide the dev server and userscript builds.

## Start here

Follow [Getting Started](./getting-started.md) to create a project, install its development script, and see a component on a matching page. For an existing Vite project, use [Manual Installation](./installation.md).

You should be familiar with JavaScript, CSS selectors, and components in your chosen framework. Prepare a browser script manager such as Tampermonkey or ScriptCat before running the script.

## Find your next step

| Goal | Read |
| --- | --- |
| Create and run your first script | [Getting Started](./getting-started.md) |
| Understand Runtime, tasks, and adapters | [Core Concepts](./concepts.md) |
| Mount a component on a target element | [Component Injection](./injection.md) |
| Listen to page events and control activity | [Event Listeners](./listeners.md) |
| Handle target replacement, reset, and destruction | [Lifecycle and Cleanup](./lifecycle.md) |
| View tasks, logs, and terminal shortcuts | [Local Development](./development.md) |
| Produce an installable userscript | [Build and Preview](./build.md) |
| Diagnose a missing script or component | [Troubleshooting](./troubleshooting.md) |
| Look up options, return values, and types | [API Reference](../api/core.md) |

## When to use Makoo

Makoo helps when a userscript has multiple injection points, components, or listeners that need to wait for asynchronous DOM, handle replaced host elements, and release resources. Native DOM APIs are usually enough for a small script that changes an element once on page load.

## Packages

| Package | Where you use it |
| --- | --- |
| `@makoojs/core` | Browser entry: create a Runtime and declare and manage tasks |
| `@makoojs/vue` / `@makoojs/react` | Browser entry: register the adapter for your framework |
| `@makoojs/cli` | Vite configuration and the `dev`, `build`, and `preview` commands |
| `@makoojs/cli/monkey` | Browser code: access the script manager’s GM APIs |
| `@makoojs/create-makoo` | Project creation |
