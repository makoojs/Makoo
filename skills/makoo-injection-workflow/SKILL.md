---
name: makoo-injection-workflow
description: Use when creating, modifying, or debugging Makoo injection composition, host listeners, React/Vue components, injectAt, injectEach, reinject, timeout, HMR, or userscript injection workflows in Makoo projects.
license: MIT
---

# Makoo Injection Workflow

Use this skill when a task involves Makoo injection composition, injection modules, React/Vue adapter selection, URL matching, or DOM injection strategy.

Also use this skill when the user is working inside a Makoo project and needs to write, modify, or debug a userscript/Tampermonkey-style feature, especially when injecting UI, components, buttons, panels, floating widgets, or page enhancements into a target website. Prefer Makoo injections over scattered manual DOM scripts. If the task is clearly outside the Makoo ecosystem, do not force this skill onto it.

## Start Here

First confirm that the current project is a Makoo project, then read the nearest relevant files:

- `vite.config.ts`: check `makoo(...)`, its `entry`, and `monkey.userscript.match`.
- Configured application module: check `createMakoo()`, `useAdapter()`, `apply()`, and any custom HMR accept/dispose.
- Files related to the target feature: follow the project's existing file layout.
- Neighboring component files: check whether the project uses Vue, React, TypeScript, or JavaScript, and how styles are organized.

Do not invent a new structure without a reason. Prefer the module names, component names, and file layout patterns already used in the project.

## When To Create An Injection Module

Create a new injection module when the request maps to an independent page enhancement unit:

- It has its own DOM target, such as a header button, profile card, floating panel, or page badge.
- It should only run on specific URLs or page areas and needs its own `injectAt`, `reinject`, or attached listeners.
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

Use `createMakoo()`, `useAdapter()`, `inject()`, `injectEach()`, and `listen()` for runtime composition. Keep React/Vue UI implementation in framework component files.

## When To Use `injectEach`

Use `injectEach()` when the same component belongs on every element matching a selector, such as a badge on every list row or comment, including rows that load later:

```ts
injectEach({
	name: 'row-badges',
	injectAt: '.feed-item .meta',
	adapter: 'vue',
	component: RowBadge
});
```

- Do not loop `inject()` over `querySelectorAll` results, and do not add a `MutationObserver` to catch new rows; the Each Injection collects new matches by itself while it runs.
- It has no `timeout`, `reinject`, or `listeners`. Zero matches keeps it `collecting`; a removed element ends that Child, and a reinserted match gets a new Child. Use standalone listeners for host events.
- All Children share the same `props` object; there are no per-element props.
- Inside each mounted component, `useMakooComponent()` / React hooks control only that Child. Outside, narrow `core.injection(name)` by `kind === 'component-each'` and use `children`.

## How To Declare Listeners

Use `listen()` for a standalone host listener and put it directly in `apply()`:

```ts
core.apply([
	listen({
		name: 'escape-close',
		listenAt: 'body',
		type: 'keydown',
		capture: true,
		callback: onEscape
	})
]);
```

Use `listeners` when a listener belongs to a component:

```ts
inject({
	name: 'panel',
	injectAt: 'body',
	adapter: 'vue',
	component: Panel,
	listeners: [
		listen({ name: 'outside-click', listenAt: 'body', type: 'click', callback: onClick })
	]
});
```

`capture` defaults to `false`. Set it to `true` to run during the DOM capture phase. Attached listeners inherit the component's `reinject` and must not set their own. Keep callbacks in browser-compatible modules.

Inside a mounted component, read attached or same-instance standalone listener status through the framework helpers (`attachedListener` / `listener`, or the React `useListener` equivalent). Control the component with `start` / `stop` / `remove` from `useMakooComponent()` or `useComponentCommand()`, or with `core.injection(name)` / `core.listener(name)` outside the component.

## How To Choose The React / Vue Adapter

Register the adapters required by the component declarations, then name them in each `inject()`:

```ts
const core = createMakoo();
core.useAdapter(createVueAdapter());
core.useAdapter(createReactAdapter());

core.apply([
	inject({
		name: 'profile-card',
		injectAt: '.profile',
		adapter: 'vue',
		component: ProfileCard
	})
]);
```

Selection rules:

- Vue components require `createVueAdapter()` and `adapter: 'vue'`.
- React components require `createReactAdapter()` and `adapter: 'react'`.
- One project can contain both. Configure both framework dependencies, Vite plugins, and adapters; configure userscript external resources only when dependencies are externalized.

Keep React/Vue differences in component files, adapter packages, or application code, outside `packages/core`.

## How To Set `injectAt`

`injectAt` is the CSS selector for the mount target. Choose it with these rules:

- Do not use `document` or `window`; they are global objects, not injection target selectors.
- Prefer stable, semantic selectors that can be found again after host DOM updates.
- Use the smallest necessary selector for UI attached to an existing area.
- Use `body` for floating panels, global widgets, toasts, and similar page-level UI.
- If the target may appear after startup, adjust `timeout` instead of polling in the component.

## URL Matching

Use `monkey.userscript.match` in `vite.config.ts` to decide which pages load the userscript.
For feature-specific routing inside one userscript, use ordinary browser code before choosing which declarations to pass to `apply()`.

## When To Use `reinject`

Use `reinject` when the target DOM can be removed and rebuilt by the host page and the injection should recover.

Enable `reinject: true` when:

- SPA route changes, list refreshes, or tab switches destroy and rebuild the target node.
- A page framework removes the target node and later creates a matching node.
- Scrolling or filtering removes and recreates the target container.

Keep `reinject` off when:

- The target node is stable.
- The module only needs one mount.
- A global floating UI injected into `body` controls its own visibility.
- Reinjection could cause duplicated requests, duplicated work, or meaningful performance cost.

For components, `reinject` recovers the whole component execution when the mount target or component container becomes invalid. When only an attached listener's target is replaced and the component has `reinject: true`, only that listener recovers; the framework component and other listeners stay. Standalone listeners set their own `reinject`.

## When To Adjust `timeout`

`timeout` is the number of milliseconds to wait for the `injectAt` or `listenAt` target to appear.

Guidance:

- Usually keep the default.
- If the page structure appears synchronously or is very stable, keep the default and avoid extra configuration.
- If the target is rendered late by async APIs, lazy loading, route changes, or third-party scripts, increase `timeout`, such as `10000`.
- If the target only appears after a user action, first check whether the module should inject into a more stable parent container instead of endlessly increasing `timeout`.
- Do not use `timeout` as a retry mechanism. Use `reinject` when the target repeatedly disappears and reappears.

## Control, Status, And HMR

Outside components, use `core.injection(name)` for components and Each Injections (narrow by `kind` before using `attachedListener` or `children`) and `core.listener(name)` for standalone listeners. Inside Vue use `useMakooComponent()`; inside React use `useComponentCommand`, `useComponentStatus`, `useListener`, and related hooks.

Makoo does not manage HMR (ADR 0004). Prefer the default entry flow so Vite full-reloads on entry changes and framework plugins update components in place. Do not add routine `import.meta.hot.dispose` cleanup.

Only dispose manually when you opt into a custom accept boundary that recreates the Core Instance:

```ts
const core = createMakoo();
// ...useAdapter, apply

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(() => core.dispose());
}
```

## Implementation Checklist

Before finishing injection work, check:

- `vite.config.ts` points `entry` to the intended application module.
- Runtime creation, adapters, and `apply()` composition are explicit in application code.
- New module files follow the project's existing layout and use stable names.
- `injectAt` is a target DOM selector, not a URL or business condition.
- `monkey.userscript.match` covers every page where the script should load.
- `timeout`, `reinject`, and attached listeners sit on the declaration (attached listeners under `listeners`).
- Repeated per-element UI uses `injectEach()`, not a loop of `inject()` calls or a hand-written observer.
- Standalone listeners use `listen()` in `apply()` and preserve an explicit `capture: false` when that matters.
- Callbacks remain browser-bundleable.
- No routine HMR dispose unless a custom accept boundary recreates the instance.
- If the project mixes React and Vue, both adapters, Vite plugins, and dependencies are configured. External globals are required only for dependencies the userscript externalizes.
