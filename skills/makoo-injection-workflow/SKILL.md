---
name: makoo-injection-workflow
description: Use when creating or modifying Makoo injection modules, injections/manifest.ts, module-level manifests, React/Vue injection components, injectAt, match, alive, timeout, hooks, and userscript injection workflows in Makoo projects.
---

# Makoo Injection Workflow

Use this skill when a task involves Makoo's `injections/` directory, injection modules, manifest configuration, React/Vue adapter selection, URL matching, or DOM injection strategy.

Also use this skill when the user is working inside a Makoo project and needs to write, modify, or debug a userscript/Tampermonkey-style feature, especially when injecting UI, components, buttons, panels, floating widgets, or page enhancements into a target website. Prefer Makoo injection modules over scattered manual DOM scripts. If the task is clearly outside the Makoo ecosystem, do not force this skill onto it.

## Start Here

First confirm that the current project is a Makoo project, then read the nearest relevant files:

- `vite.config.ts`: check `makoo(...)`, `monkey.userscript.match`, `source`, `injector`, and `runtime.setup`.
- `injections/manifest.ts` or `injections/manifest.js`: check the top-level manifest style.
- Target module directory: if `injections/<module>/manifest.ts` already exists, respect the module-level configuration first.
- Neighboring component files: check whether the project uses Vue, React, TypeScript, or JavaScript, and how styles are organized.

Do not invent a new structure without a reason. Prefer the module names, component names, and file layout patterns already used in the project.

## When To Create An Injection Module

Create a new injection module when the request maps to an independent page enhancement unit:

- It has its own DOM target, such as a header button, profile card, floating panel, or page badge.
- It should only run on specific URLs or page areas and needs its own `match`, `injectAt`, `alive`, or hooks.
- It has different lifecycle, style, or state boundaries from existing modules.
- It may need to be enabled, disabled, removed, or moved independently later.

Do not create a new module for a small UI or state change inside an existing component. Edit the existing component instead.

Recommended structure:

```txt
injections
|-- manifest.ts
`-- profile-card
    |-- app.vue
    `-- manifest.ts
```

Common React structure:

```txt
injections
`-- profile-card
    |-- app.tsx
    `-- style.css
```

Common Vue structure:

```txt
injections
`-- profile-card
    `-- app.vue
```

## How To Write `injections/manifest.ts`

Use `defineInjections()` from `@makoojs/cli` in the top-level manifest. Prefer the object form because each object key becomes a stable module id, which fits most projects:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	globalInjector: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	injections: {
		'profile-card': {
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	}
});
```

Use the array form only when the configuration is generated, a list is clearer than object keys, or a stable `name` must be explicit:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: [
		{
			name: 'profile-card',
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	]
});
```

Put only true collection-level defaults in `globalInjector`. Override them on individual modules when a module needs different behavior.

## How To Organize An Injection Module Internally

When writing an injection module with React, Vue, or another frontend framework, follow that framework's normal project organization and coding habits.

Treat an injection module as a small frontend module. `app.vue`, `app.tsx`, or `app.jsx` should be the module entry component. Complex UI should still be split into framework-level components, hooks, styles, and helpers instead of being packed into one large entry file.

For React modules:

- Prefer a component-based structure.
- Keep `app.tsx` or `app.jsx` as the module entry component when possible.
- Put reusable UI in a module-local `components/` directory.
- Put reusable logic in module-local `hooks/` or helper files.
- Do not pack all UI, state, effects, and helper logic into one large file.

For Vue modules:

- Prefer Single File Components.
- Keep `app.vue` as the module entry component when possible.
- Put reusable components in a module-local `components/` directory.
- Prefer `<script setup>`.
- Keep component styles close to the component unless the module has shared styles.

Makoo manifest files should only describe injection behavior, such as `injectAt`, `match`, `framework`, `alive`, `scope`, and `timeout`. Keep the actual React/Vue UI implementation in the framework component files.

## Where Component Files Should Live

By default, place components under `injections/<module-name>/`:

- Vue: `injections/<module-name>/app.vue`
- React + TypeScript: `injections/<module-name>/app.tsx`
- React + JavaScript: `injections/<module-name>/app.jsx`
- Module-private styles: keep them in the same directory, such as `style.css`, and import them from the component.
- Module-private helpers: keep them in the same directory or a child directory, unless the project already has another convention.

In the top-level `injections/manifest.ts`, `component` paths are resolved relative to `injections/manifest.ts`:

```ts
component: './profile-card/app.vue'
```

In module-level `injections/<module>/manifest.ts`, `component` paths are resolved relative to the module directory:

```ts
// injections/profile-card/manifest.ts
export default {
	injectAt: '.profile',
	component: './app.vue'
};
```

## When To Use Module-Level `manifest.ts`

Use a module-level manifest when the module should own its injection semantics:

- The module has independent `injectAt`, `component`, `framework`, `match`, `alive`, `timeout`, or hooks.
- The top-level manifest is becoming long and moving module details out would make it clearer.
- The module should move or be reused together with its component files.
- The module needs local hooks/helpers and Makoo should statically track those local manifest dependencies.

Module-level example:

```ts
// injections/profile-card/manifest.ts
export default {
	injectAt: '.profile',
	component: './app.vue',
	alive: true,
	scope: 'global',
	timeout: 10000,
	match: {
		include: ['https://example.com/profile/*'],
		exclude: ['https://example.com/profile/settings']
	}
};
```

**Module definition source priority**: if a module-level manifest and the top-level manifest define the same module id, the module-level manifest replaces the top-level resolved result for that module. Do not maintain the same module's core configuration in both places.

**Default field inheritance priority**: `module config` > `manifest.globalInjector` > `vite.config.ts injector` > `Makoo default`.

This priority only applies to default field inheritance within a module configuration, such as `alive`, `scope`, `timeout`, and `hooks`. Explicit module fields have the highest priority; missing fields are filled from global config or defaults.

## How To Choose The React / Vue Adapter

Most Makoo projects do not need manual adapter registration. The CLI generates imports from the final injection list's `framework` values and calls:

```ts
injector.applyAdapter(createVueAdapter());
injector.applyAdapter(createReactAdapter());
```

Selection rules:

- `.vue` components use the Vue adapter.
- `.tsx` and `.jsx` components use the React adapter.
- When `framework` is omitted or set to `'auto'`, Makoo infers it from the component extension.
- Set `framework: 'Vue'` or `framework: 'React'` explicitly when the extension cannot be inferred, the component path is unusual, or migration work needs clearer behavior.
- One project can contain both Vue and React modules, but verify that dependencies, Vite plugins, and userscript external resources support the selected frameworks.

Do not add framework branching to `packages/core` or ordinary injection components. React/Vue differences should stay in component files, adapter packages, or the CLI-generated entry layer.

## How To Set `injectAt`

`injectAt` is the CSS selector for the target node. Choose it with these rules:

- Prefer stable, semantic selectors that still exist after page refreshes.
- When injecting into an existing area, use the smallest necessary selector, such as `.profile-header`; do not default to `body`.
- Use `body` for floating panels, global widgets, toasts, debug entry points, and similar UI that controls its own positioning.
- If a third-party page frequently re-renders, choose a container that reappears after rendering and combine it with `alive` reinjection.
- If the target node may appear after the script starts, wait with `timeout` instead of writing custom polling inside the component.

Do not use `injectAt` for URL matching. Put URL conditions in `match` or `monkey.userscript.match`.

## How To Set `match`

`match` controls whether the current module is registered at runtime. It checks `location.href`.

Shorthand:

```ts
match: ['https://example.com/profile/*']
```

Object form:

```ts
match: {
	include: ['https://example.com/profile/*'],
	exclude: ['https://example.com/profile/settings']
}
```

Rules:

- If the whole userscript serves one broad set of pages, put the broad URL rules in `vite.config.ts` under `monkey.userscript.match`.
- If one userscript contains multiple modules that should run on different pages, use module-level `match`.
- `match` cannot make a script run on a page that the userscript manager did not load. The script must first be loaded by `monkey.userscript.match`; only then can Makoo apply module-level filtering.
- Use `exclude` for settings pages, edit pages, login pages, or other pages with similar structure where injection should not happen.
- When `match` is omitted, the module registers on pages where the userscript is already running.

## When To Use `alive`

Use `alive` when the target DOM can be removed and rebuilt by the host page and the injection should be restored.

Enable `alive: true` when:

- SPA route changes, list refreshes, or tab switches destroy and rebuild the target node.
- The target area is frequently re-rendered by React, Vue, or another page framework.
- Scrolling or filtering causes the page to regenerate the container.
- The injected UI must keep following a target area over time.

Keep `alive: false` when:

- The target node is stable.
- The module only needs one mount.
- A global floating UI injected into `body` controls its own visibility.
- Reinjection could cause duplicated requests, duplicated listeners, or meaningful performance cost.

Choose `scope` this way:

- `local`: prefer this default. It observes near the current mount area and has lower overhead.
- `global`: use this when the target node may be replaced or reappear anywhere in the document.

`alive` only applies to component or artifact injection tasks. It is not for standalone listener tasks.

## When To Adjust `timeout`

`timeout` is the number of milliseconds to wait for the `injectAt` target to appear.

Guidance:

- Usually keep the default `5000`.
- If the page structure appears synchronously or is very stable, keep the default and avoid extra configuration.
- If the target is rendered late by async APIs, lazy loading, route changes, or third-party scripts, increase module-level `timeout`, such as `10000`.
- If the target only appears after a user action, first check whether the module should inject into a more stable parent container instead of endlessly increasing `timeout`.
- Do not use `timeout` as a retry mechanism. Use `alive` when the target repeatedly disappears and reappears.

## Hooks And Dependency Tracking

Hooks can live in `globalInjector.hooks` or in module config:

- Global hooks: project-level logging, observation, and debugging.
- Module hooks: lifecycle work, analytics, or cleanup that belongs only to one module.

If hooks are split into another file, import them with a static relative path:

```ts
import { hooks } from './hooks';
```

Makoo tracks local dependency chains such as `manifest -> hooks -> helper`. Do not rely on dynamic `import()`, path aliases, or third-party package changes to trigger manifest structure rescans.

## Enable, Disable, And Scan Behavior

- Modules default to `enabled: true`.
- Use `enabled: false` to keep a module config in the manifest while excluding it from the generated runtime.
- `source.include` and `source.exclude` filter module directory scanning; they are not URL matching rules.
- Changes to the top-level manifest, module-level manifests, and static relative imports from manifests trigger structural updates.
- Ordinary component changes are handled by Vite HMR.

## Implementation Checklist

Before finishing injection work, check:

- New modules live under `injections/<module-name>/` with stable names.
- `component` paths are written relative to the manifest file that declares them.
- `framework` can be inferred from the extension; if not, it is explicitly configured.
- `injectAt` is a target DOM selector, not a URL or business condition.
- `match` only does module-level filtering, and `monkey.userscript.match` covers the pages where the script should run.
- `alive` is only enabled when the DOM can be rebuilt and injection truly needs to recover.
- `timeout` reflects when the target node appears and is not hiding an incorrect selector.
- Hooks use static relative imports.
- If the project mixes React and Vue, dependencies, Vite plugins, and userscript external globals support the selected frameworks.
