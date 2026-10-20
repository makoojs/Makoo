---
name: makoo-best-practices
description: Use when building, reviewing, or refactoring Makoo-powered userscript projects and an agent needs high-level guidance for browser entries, injections, host listeners, framework adapters, DOM mounting, reinjection, HMR, or Vue plugin setup.
license: MIT
---

# Makoo Best Practices

Use this skill when working on a downstream project that uses Makoo to build userscripts or injection-based page enhancements. It is a high-level guardrail for idiomatic Makoo usage.

Do not use this skill for developing the Makoo framework/monorepo itself; use the Makoo framework development skill for that. For detailed entry and module decisions, also use the Makoo injection workflow skill.

## Core Rule

`createMakoo()`, `useAdapter()`, `inject()`, and `listen()` provide runtime composition, while framework components contain the product UI. A project may organize the related files like this:

```txt
src
|-- main.ts
`-- injections
    `-- toolbar-button
        |-- App.tsx
        `-- style.css
```

Create a Core Instance, register the adapters in use, declare injections with `inject()` and `listen()`, then hand them to `apply()`. Point `makoo({ entry })` at the chosen application module.

Do not use `querySelector()` plus `appendChild()` and framework mount calls as the primary injection flow. Small DOM reads inside components are still appropriate for measurement, focus management, or host-page interop.

## Compose Injections Explicitly

```ts
import { createMakoo, inject, listen } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import ToolbarButton from './injections/toolbar-button/App';

const core = createMakoo();
core.useAdapter(createReactAdapter());

core.apply([
	inject({
		name: 'toolbar-button',
		injectAt: '.toolbar',
		adapter: 'react',
		component: ToolbarButton,
		timeout: 5000,
		reinject: true,
		listeners: [
			listen({
				name: 'toolbar-click',
				listenAt: '.toolbar',
				type: 'click',
				callback: onToolbarClick
			})
		]
	}),
	listen({
		name: 'escape-close',
		listenAt: 'body',
		type: 'keydown',
		callback: onEscape
	})
]);
```

Keep `name` stable. Put wait duration in `timeout`, recovery in `reinject`, and component-owned host listeners in `listeners`. Standalone listeners use `listen()` directly in `apply()`.

Control and status live on the instance: `core.injection(name)` for components and `core.listener(name)` for standalone listeners. Inside a mounted component, use the framework helpers (`useMakooComponent()` or the React hooks) instead of reaching for the instance.

## Put Component Logic In Framework Files

Use a framework component as the UI boundary and follow the project's existing file layout and naming.

Keep component state, effects, event handling, rendering, and UI composition in framework files.

Keep imperative DOM creation out of runtime composition code.

## Register Framework Adapters

Call `core.useAdapter(createVueAdapter())` for Vue components and `core.useAdapter(createReactAdapter())` for React components. Pass the matching adapter name in each `inject({ adapter })`.

Do not call `createRoot`, `ReactDOM.render`, `createApp`, or `app.mount` as the primary injection flow. Mixed-framework projects need both framework dependencies, Vite plugins, and adapters. Configure userscript external globals only when those dependencies are externalized.

## Vue Plugin Setup

Register shared Vue plugins before `apply()`:

```ts
import { VuePlugin, createVueAdapter } from '@makoojs/vue';
import { createPinia } from 'pinia';

VuePlugin.use(createPinia());

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([/* ... */]);
```

Import `VuePlugin` from `@makoojs/vue` so registration and the adapter use the same instance. Plugins registered after a mount do not retroactively install on already mounted apps. Use `VuePlugin.clear()` in tests or special runtimes when shared plugin state must be reset.

## Keep URL And DOM Rules Separate

- `monkey.userscript.match` controls where the userscript manager loads the script.
- Browser routing code controls which feature declarations enter `apply()`.
- `injectAt` selects the DOM target where a component mounts.

Do not encode URL rules in `injectAt` or use DOM selectors as URL routing.

## Use `reinject` And `timeout` Deliberately

Keep defaults unless the page behavior requires a change:

- Use `timeout` when the target node appears late.
- Use `reinject: true` when the host page removes and rebuilds the mount or listener target and the injection must recover.
- Keep `reinject` off for stable targets or body-mounted floating UI that controls its own visibility.
- Attached listeners inherit the component's `reinject`; they must not set their own.

Do not use `timeout` as a retry loop. Do not enable `reinject` everywhere by default.

## Respect Vite HMR

Makoo does not manage HMR. Leave cleanup to Vite and the framework plugins (see ADR 0004):

- Editing a Vue SFC or a React Fast Refresh boundary updates in place; the entry does not re-run.
- Editing the entry or a non-boundary module triggers a full page reload; the old Core Instance dies with the page.

Do not add `import.meta.hot.dispose(() => core.dispose())` in the normal entry. Only dispose manually if you opt into a custom `import.meta.hot.accept()` boundary that recreates the Core Instance.

Restart the dev server for Vite plugin, alias, or package-resolution changes.

## Review Checklist

- `makoo({ entry })` points to the intended application module.
- The entry creates a Core Instance, registers adapters, and calls `apply()`; components own UI behavior.
- Injections use `name`, `adapter`, `component`, and top-level `timeout` / `reinject` / `listeners`.
- React and Vue mounting goes through Makoo adapters.
- Listener `capture` is chosen deliberately and explicit `false` is preserved.
- Callbacks stay browser-bundleable.
- `monkey.userscript.match` covers every target page.
- `injectAt`, `reinject`, and `timeout` each serve their distinct purpose.
- No routine HMR dispose unless a custom accept boundary recreates the instance.
