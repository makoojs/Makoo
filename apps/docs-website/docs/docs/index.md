# Introduction

Makoo is a userscript development framework for building maintainable Vue and React
injection apps for browser script managers such as Tampermonkey, Violentmonkey, and
ScriptCat.

It is designed for scripts that are no longer just a few lines of DOM manipulation. Once
your userscript starts mounting UI, reacting to page redraws, sharing state across multiple
injection points, or splitting features into separate modules, the hard part becomes keeping
the runtime predictable. Makoo gives that work a framework-shaped structure.

## Why Makoo Exists

Traditional userscripts are easy to start and hard to keep tidy. Browser pages can render
late, replace large DOM subtrees, navigate without a full reload, or remove the node that
your script mounted into. At the same time, modern script projects often want component UI,
typed configuration, local development, hot updates, and a build output that still installs
cleanly in a script manager.

Makoo focuses on that middle layer between your component code and the userscript manager:

- waiting for target DOM nodes before mounting
- registering injection modules from a declarative manifest
- mounting Vue and React components through adapters
- observing page changes and reinjecting modules when needed
- keeping manifest and module structure changes hot-updated during development

Build output, userscript metadata, install behavior, and script-manager integration are still
handled by `vite-plugin-monkey`. Makoo builds on top of it with a project model for
component-driven injection apps.

## When To Use It

Makoo is a good fit when you are building a userscript that behaves more like a small
frontend application than a single snippet.

Use it when your project has one or more of these needs:

- multiple injection points on the same page
- Vue or React components mounted into an existing website
- page-specific modules controlled by URL rules
- reinjection after the host page redraws or replaces content
- a predictable project structure for a growing userscript codebase
- Vite-based development with structural HMR for manifests and modules

For very small scripts that only tweak one element once, plain userscript code may still be
enough. Makoo becomes useful when the lifecycle, structure, or long-term maintenance starts
to matter.

## The Mental Model

A Makoo app is built from a few small pieces:

| Piece | Role |
| --- | --- |
| Manifest | Declares which modules exist, where they mount, and when they run |
| Injection module | Owns a single feature or mount point under `injections/` |
| Injector | Waits for targets, registers tasks, mounts modules, and manages reinjection |
| Adapter | Bridges Makoo's runtime to Vue or React mounting behavior |
| Vite plugin | Scans manifests, generates the virtual entry, and integrates with `vite-plugin-monkey` |

In practice, you describe the desired injections in `injections/manifest.ts`, place each
feature under its own module directory, and let Makoo generate the runtime entry that mounts
those modules on matching pages.

## What Makoo Adds

- A declarative injection manifest
- A runtime injector for component mounting
- DOM watching and alive reinjection
- Vue and React adapters
- Vite plugin integration for development and build flows

## Guide Path

If you are new to Makoo, read the guide in this order:

1. [Getting Started](./getting-started.md) to scaffold a project and define your first
   injection.
2. [Core Concepts](./concepts.md) to understand injectors, modules, manifests, and adapters.
3. [Configuration](./configuration.md) to learn how Makoo, Vite, and `vite-plugin-monkey`
   fit together.
4. [Manifest Reference](./manifest.md) when you need exact fields for module behavior.
5. [HMR](./hmr.md) to understand what updates automatically during development.
6. [Recipes](./recipes.md) for common patterns you can adapt directly.

## Quick Start Preview

```bash
pnpm dlx @makoojs/create-makoo
```

Then install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```
