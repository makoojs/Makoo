---
name: makoo-best-practices
description: Use when building, reviewing, or refactoring Makoo-powered userscript projects and an agent needs high-level guidance for browser entries, injection modules, listeners, runtime callbacks, framework adapters, DOM mounting, HMR, or Vue plugin setup.
license: MIT
---

# Makoo Best Practices

Use this skill when working on a downstream project that uses Makoo to build userscripts or injection-based page enhancements. It is a high-level guardrail for idiomatic Makoo usage.

Do not use this skill for developing the Makoo framework/monorepo itself; use the Makoo framework development skill for that. For detailed entry and module decisions, also use the Makoo injection workflow skill.

## Core Rule

`createMakoo()`, `inject()`, and `listen()` provide runtime composition, while framework
components contain the product UI. A project may organize the related files like this:

```txt
src
|-- main.ts
`-- injections
    `-- toolbar-button
        |-- App.tsx
        `-- style.css
```

Use `createMakoo()` to create the runtime, register the adapters in use, declare tasks with
`inject()` and `listen()`, then start them. Point `makoo({ entry })` at the chosen application module.

Do not use `querySelector()` plus `appendChild()` and framework mount calls as the primary
injection flow. Small DOM reads inside components are still appropriate for measurement,
focus management, or host-page interop.

## Compose Tasks Explicitly

```ts
const makoo = createMakoo({
	adapters: [createReactAdapter()],
	defaults: { alive: false, scope: 'local', timeout: 5000 }
});

const tasks = makoo.start([
	inject({
		id: 'toolbar-button',
		injectAt: '.toolbar',
		artifact: ToolbarButton,
		options: { alive: true }
	}),
	listen({
		id: 'escape-close',
		listenAt: 'body',
		type: 'keydown',
		callback: onEscape
	})
]);
```

Keep `id` stable. Put `alive`, `scope`, `timeout`, task hooks, and component-owned listeners
under `options`. Standalone listeners use `listen()` directly.

## Put Component Logic In Framework Files

Use a framework component as the UI boundary and follow the project's existing file layout and naming.

Keep component state, effects, event handling, rendering, and UI composition in framework files.

Keep imperative DOM creation out of runtime composition code.

## Register Framework Adapters

Use `createVueAdapter()` for Vue artifacts and `createReactAdapter()` for React artifacts.
Do not call `createRoot`, `ReactDOM.render`, `createApp`, or `app.mount` as the primary
injection flow. Mixed-framework projects need both framework dependencies, Vite plugins, and
adapters. Configure userscript external globals only when those dependencies are externalized.

## Vue Plugin Setup

Register shared Vue plugins before creating tasks:

```ts
import { VuePlugin, createVueAdapter } from '@makoojs/vue';
import { createPinia } from 'pinia';

VuePlugin.use(createPinia());
const makoo = createMakoo({ adapters: [createVueAdapter()] });
```

Import `VuePlugin` from `@makoojs/vue` so registration and the adapter use the same instance.
Use `VuePlugin.clear()` in tests or special runtimes when shared plugin state must be reset.

## Keep URL And DOM Rules Separate

- `monkey.userscript.match` controls where the userscript manager loads the script.
- Browser routing code controls which feature tasks enter the task list.
- `injectAt` selects the DOM target where a component mounts.

Do not encode URL rules in `injectAt` or use DOM selectors as URL routing.

## Use `alive` And `timeout` Deliberately

Keep defaults unless the page behavior requires a change:

- Use `options.timeout` when the target node appears late.
- Use `options.alive` when the host page removes and rebuilds the target node and the injection must recover.
- Keep `options.alive: false` for stable targets or body-mounted floating UI that controls its own visibility.
- Prefer `options.scope: 'local'`. Use `global` only when removal must be observed across the
  wider document; restoration still searches the document in either mode.

Do not use `timeout` as a retry loop. Do not enable `alive` everywhere by default.

## Respect Vite HMR

Dispose started tasks during HMR so an updated module does not leave duplicate runtime state:

```ts
if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

Restart the dev server for Vite plugin, alias, or package-resolution changes.

## Review Checklist

- `makoo({ entry })` points to the intended application module.
- The entry composes runtime tasks and adapters; components own UI behavior.
- Task options use the `options` field.
- React and Vue mounting goes through Makoo adapters.
- Listener `capture` is chosen deliberately and explicit `false` is preserved.
- Hooks, callbacks, and activity signals are browser-bundleable.
- `monkey.userscript.match` covers every target page.
- `injectAt`, `alive`, and `timeout` each serve their distinct purpose.
- Started tasks are destroyed during HMR disposal.
