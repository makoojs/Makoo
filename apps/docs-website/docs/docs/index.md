# Introduction

Makoo is a userscript development framework for building maintainable Vue and React
injection apps for browser script managers such as Tampermonkey, Violentmonkey, and
ScriptCat.

It is designed for userscripts that mount components, compose multiple feature tasks, or
activate different injection points on different pages. Makoo runs, mounts, and cleans up
those tasks.

## Why Makoo Exists

Traditional userscripts are easy to start and hard to keep tidy. Browser pages can render
late, replace large DOM subtrees, navigate without a full reload, or remove the node that
your script mounted into. At the same time, modern script projects often want component UI,
typed configuration, local development, hot updates, and a build output that still installs
cleanly in a script manager.

Makoo focuses on that middle layer between your component code and the userscript manager:

- waiting for target DOM nodes before mounting
- composing injection tasks with `inject()` and `listen()`
- mounting Vue and React components through adapters
- observing removal of a host target and reinjecting when the same selector appears again

`vite-plugin-monkey` handles build output, userscript metadata, installation, and script-manager
integration. Makoo provides runtime composition and adapters for component injection.

## When To Use It

Makoo can compose userscripts that contain multiple components, tasks, or lifecycle behaviors.

Use it when your project has one or more of these needs:

- multiple injection points on the same page
- Vue or React components mounted into an existing website
- page-specific modules controlled by URL rules
- reinjection after a host target node is removed and recreated

For very small scripts that only tweak one element once, plain userscript code may still be
enough. Makoo becomes useful when the lifecycle, structure, or long-term maintenance starts
to matter.

## The Mental Model

A Makoo app is built from a few small pieces:

| Piece | Role |
| --- | --- |
| Task declarations | Define which tasks exist, where they mount, and when they run |
| Injection module | An independent injection feature or mount unit |
| Makoo runtime | Declares tasks, waits for targets, mounts modules, and manages reinjection |
| Adapter | Bridges Makoo's runtime to Vue or React mounting behavior |
| Vite plugin | Connects Makoo configuration to Vite and `vite-plugin-monkey` |

`monkey.userscript.match` controls where the script manager loads the userscript.
Application code uses `createMakoo()`, `inject()`, and `listen()` to compose the tasks to start,
and the Makoo runtime waits for target DOM nodes before mounting. Projects can organize the
related code according to their own conventions.

## What Makoo Adds

- Explicit runtime composition with `inject()` and `listen()`
- A runtime scheduler for component mounting
- host target removal observation and alive reinjection
- Vue and React adapters
- Vite plugin integration for development and build flows

## Guide Path

If you are new to Makoo, read the guide in this order:

1. [Getting Started](./getting-started.md) to scaffold a project and define your first
   injection.
2. [Core Concepts](./concepts.md) to understand the runtime, tasks, modules, and adapters.
3. [Configuration](./configuration.md) to learn how Makoo, Vite, and `vite-plugin-monkey`
   fit together.
4. [HMR](./hmr.md) to understand development updates and cleanup.
5. [Recipes](./recipes.md) for common patterns you can adapt directly.

## Quick Start Preview

```bash
pnpm dlx @makoojs/create-makoo
```

Then install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```
