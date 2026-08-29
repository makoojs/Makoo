---
name: makoo-injection-workflow
description: Use when creating, modifying, or debugging Makoo task composition, injection modules, listeners, hooks, callbacks, activity signals, React/Vue components, injectAt, alive, timeout, HMR, or userscript injection workflows in Makoo projects.
license: MIT
---

# Makoo Injection Workflow

Use this skill when a task involves Makoo task composition, injection modules, React/Vue adapter selection, URL matching, or DOM injection strategy.

Also use this skill when the user is working inside a Makoo project and needs to write, modify, or debug a userscript/Tampermonkey-style feature, especially when injecting UI, components, buttons, panels, floating widgets, or page enhancements into a target website. Prefer Makoo injection modules over scattered manual DOM scripts. If the task is clearly outside the Makoo ecosystem, do not force this skill onto it.

## Start Here

First confirm that the current project is a Makoo project, then read the nearest relevant files:

- `vite.config.ts`: check `makoo(...)`, its `entry`, and `monkey.userscript.match`.
- Configured application module: check runtime creation, adapters, task declarations, and HMR cleanup.
- Files related to the target feature: follow the project's existing file layout.
- Neighboring component files: check whether the project uses Vue, React, TypeScript, or JavaScript, and how styles are organized.

Do not invent a new structure without a reason. Prefer the module names, component names, and file layout patterns already used in the project.

## When To Create An Injection Module

Create a new injection module when the request maps to an independent page enhancement unit:

- It has its own DOM target, such as a header button, profile card, floating panel, or page badge.
- It should only run on specific URLs or page areas and needs its own `injectAt`, `alive`, or hooks.
- It has different lifecycle, style, or state boundaries from existing modules.
- It may need to be enabled, disabled, removed, or moved independently later.

Do not create a new module for a small UI or state change inside an existing component. Edit the existing component instead.

## How To Organize An Injection Module Internally

When writing an injection module with React, Vue, or another frontend framework, follow that framework's normal project organization and coding habits.

Treat an injection module as a small frontend module. Its root component and file layout can follow the project's conventions.

For React modules:

- Prefer a component-based structure.
- Follow the project's existing root component naming and placement.

For Vue modules:

- Prefer Single File Components.
- Follow the project's existing root component naming and placement.
- Prefer `<script setup>`.
- Keep component styles close to the component unless the module has shared styles.

Use `createMakoo()`, `inject()`, and `listen()` for runtime composition. Keep React/Vue UI implementation in framework component files.

## How To Declare Listeners

Use `listen()` for a standalone DOM listener:

```ts
const escapeClose = listen({
	id: 'escape-close',
	listenAt: 'body',
	type: 'keydown',
	capture: true,
	callback: onEscape
});
```

Use `options.on` when a listener belongs to a component task:

```ts
inject({
	id: 'panel',
	injectAt: 'body',
	artifact: Panel,
	options: {
		on: listen({ listenAt: 'body', type: 'click', callback: onClick })
	}
});
```

`capture` defaults to `false`. Set it to `true` to run the listener during the DOM capture
phase. `activitySignal` controls whether the event listener is attached; it does not change the
task's runtime status. Keep callbacks and signal implementations in browser-compatible modules.

## How To Choose The React / Vue Adapter

Import and register the adapters required by the task artifacts.

```ts
const makoo = createMakoo({
	adapters: [createVueAdapter(), createReactAdapter()]
});

const tasks = [
	inject({ id: 'profile-card', injectAt: '.profile', artifact: ProfileCard })
];

makoo.start(tasks);
```

Selection rules:

- Vue components require `createVueAdapter()`.
- React components require `createReactAdapter()`.
- One project can contain both Vue and React modules. Configure both framework dependencies,
  Vite plugins, and adapters; configure userscript external resources only when dependencies
  are externalized.

Keep React/Vue differences in component files, adapter packages, or application code, outside `packages/core`.

## How To Set `injectAt`

`injectAt` is the CSS selector for the target node. Choose it with these rules:

- Do not use `document` or `window`; they are global objects, not injection target selectors.
- Prefer stable, semantic selectors that can be found again after host DOM updates.
- Use the smallest necessary selector for UI attached to an existing area.
- Use `body` for floating panels, global widgets, toasts, and similar page-level UI.
- If the target may appear after startup, adjust `options.timeout` instead of polling in the component.

## URL Matching

Use `monkey.userscript.match` in `vite.config.ts` to decide which pages load the userscript.
For feature-specific routing inside one userscript, use ordinary browser code before adding
tasks to the list.

## When To Use `alive`

Use `alive` when the target DOM can be removed and rebuilt by the host page and the injection should be restored.

Enable `options.alive: true` when:

- SPA route changes, list refreshes, or tab switches destroy and rebuild the target node.
- A page framework removes the target node and later creates a matching node.
- Scrolling or filtering removes and recreates the target container.

Keep `options.alive: false` when:

- The target node is stable.
- The module only needs one mount.
- A global floating UI injected into `body` controls its own visibility.
- Reinjection could cause duplicated requests, duplicated listeners, or meaningful performance cost.

Choose `options.scope` this way:

- `local`: prefer this default. It observes removal from the current host's parent.
- `global`: observe removal across the document body. Restoration searches the document in
  either mode.

`alive` only applies to component or artifact injection tasks. It is not for standalone listener tasks.

## When To Adjust `timeout`

`options.timeout` is the number of milliseconds to wait for the `injectAt` target to appear.

Guidance:

- Usually keep the default `5000`.
- If the page structure appears synchronously or is very stable, keep the default and avoid extra configuration.
- If the target is rendered late by async APIs, lazy loading, route changes, or third-party scripts, increase `options.timeout`, such as `10000`.
- If the target only appears after a user action, first check whether the module should inject into a more stable parent container instead of endlessly increasing `timeout`.
- Do not use `timeout` as a retry mechanism. Use `alive` when the target repeatedly disappears and reappears.

## Hooks, Callbacks, And HMR

Global hooks belong in `createMakoo({ hooks })`; task hooks belong in `inject({ options: { hooks } })`.
Callbacks, hooks, activity signals, and imported modules run in the browser, so keep their
dependency graph browser-compatible.

Dispose started tasks during Vite HMR:

```ts
const tasks = makoo.start(taskDeclarations);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

## Implementation Checklist

Before finishing injection work, check:

- `vite.config.ts` points `entry` to the intended application module.
- Runtime creation, adapters, and task composition are explicit in application code.
- New module files follow the project's existing layout and use stable names.
- `injectAt` is a target DOM selector, not a URL or business condition.
- `monkey.userscript.match` covers every page where the script should load.
- `alive`, `scope`, `timeout`, `hooks`, and component-owned listeners are nested under `options`.
- Standalone listeners use `listen()` and preserve an explicit `capture: false`.
- Hooks, callbacks, and activity signals remain browser-bundleable.
- The entry destroys started tasks during HMR.
- If the project mixes React and Vue, both adapters, Vite plugins, and dependencies are
  configured. External globals are required only for dependencies the userscript externalizes.
