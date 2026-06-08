---
name: makoo-best-practices
description: Use when building, reviewing, or refactoring Makoo-powered userscript projects and an agent needs high-level Makoo best practices for injection modules, manifests, framework components, adapters, DOM mounting, HMR boundaries, Vue plugin setup, and structural changes.
---

# Makoo Best Practices

Use this skill when working on a downstream project that uses Makoo to build userscripts or injection-based page enhancements. It is a high-level guardrail for idiomatic Makoo usage.

Do not use this skill for developing the Makoo framework/monorepo itself; use the Makoo framework development skill for that. For detailed module and manifest decisions, also use the Makoo injection workflow skill.

## Core Rule

Makoo owns the injection lifecycle. A Makoo project should describe what to inject with manifests and implement the UI with framework components. It should not hand-roll the main injection pipeline.

Prefer this shape:

```txt
injections
|-- manifest.ts
`-- toolbar-button
    |-- app.tsx
    `-- style.css
```

Avoid this as the main flow:

```ts
const target = document.querySelector('.toolbar');
const root = document.createElement('div');
target?.appendChild(root);
```

Small DOM reads inside a component can be acceptable for measurement, focus management, or host-page interop. They should not replace Makoo's module registration, target waiting, adapter mounting, or reinjection lifecycle.

## Prefer `defineInjections`

Use `defineInjections()` in `injections/manifest.ts` for top-level module registration.

Good:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		'toolbar-button': {
			injectAt: '.toolbar',
			component: './toolbar-button/app.tsx'
		}
	}
});
```

Avoid manually creating a separate userscript runtime entry just to query the DOM and mount React/Vue. Let Makoo generate the runtime entry from the manifest.

## Keep Manifest Declarative

Manifest files should describe injection configuration only:

- `injectAt`
- `component`
- `framework`
- `match`
- `enabled`
- `alive`
- `scope`
- `timeout`
- hooks or listener configuration when supported by the current Makoo project

Do not put UI state, rendering logic, component trees, network workflows, or business behavior in manifest files. Move those into `app.tsx`, `app.jsx`, `app.vue`, or module-local helpers.

Use module-level `manifest.ts` when a module should own its own injection configuration. Keep top-level `injections/manifest.ts` focused on registration and shared defaults.

## Put Component Logic In Framework Files

Use the module entry component as the UI boundary:

- React: `injections/<module>/app.tsx` or `app.jsx`
- Vue: `injections/<module>/app.vue`

Keep component state, effects, event handling, rendering, and UI composition in framework files. Split larger modules into module-local `components/`, `hooks/`, `composables/`, `utils/`, or style files according to the framework already used by the project.

Do not solve UI composition by writing imperative DOM creation in manifest files or runtime setup files.

## Let Makoo Handle React/Vue Adapters

Do not manually call `createRoot`, `ReactDOM.render`, `createApp`, or `app.mount` as the primary injection flow in a Makoo project.

Makoo resolves the framework from the component extension or explicit `framework` field, imports the needed adapter, and applies it to the injector. Use:

- `.vue` for Vue modules.
- `.tsx` or `.jsx` for React modules.
- explicit `framework: 'Vue'` or `framework: 'React'` only when inference is not clear.

If a project mixes React and Vue modules, verify that dependencies, Vite plugins, and userscript external resources support both frameworks. Do not add custom framework switching inside normal components.

## Vue Plugin Setup

If Vue modules need shared plugins such as router, i18n, Pinia, or a UI library, strictly follow this pattern.

In CLI projects, register Vue plugins from a setup file referenced by `runtime.setup`:

```ts
// vite.config.ts
makoo({
	runtime: {
		setup: './injections/vue-setup.ts'
	}
});
```

```ts
// injections/vue-setup.ts
import { VuePlugin } from '@makoojs/vue';
import { createPinia } from 'pinia';

VuePlugin.use(createPinia());
```

Multiple plugins can be registered together:

```ts
VuePlugin.usePlugins(router, i18n);
```

Makoo's Vue adapter automatically installs plugins registered through `VuePlugin` into the Vue app for each mounted Vue module. The agent should follow the setup pattern above instead of implementing a separate Vue app lifecycle.

Import `VuePlugin` from `@makoojs/vue` in the setup file. Do not import it from source paths or path aliases, because that can register plugins on a different `VuePlugin` instance from the one used by the Vue adapter.

In tests or special runtimes, call `VuePlugin.clear()` when needed to avoid leaking shared plugin state between cases or environments.

## Respect HMR Boundaries

Ordinary component changes should be left to Vite HMR:

- `app.tsx`, `app.jsx`, `app.vue`
- child components
- CSS imported by components
- module-local UI helpers used by components

Structural changes are the ones that should cause Makoo to rescan or regenerate the injection entry:

- top-level `injections/manifest.ts`
- module-level `injections/<module>/manifest.ts`
- hooks or helpers statically imported by a manifest
- `vite.config.ts` Makoo config
- `source.include`, `source.exclude`, `runtime.setup`, or userscript metadata that changes the generated runtime

Do not force a structural rescan for ordinary UI edits. Do not move component-only logic into manifest files just to affect HMR.

## Use `match` And `injectAt` For Different Jobs

Keep URL and DOM concerns separate:

- `monkey.userscript.match`: controls where the userscript manager loads the script.
- module `match`: controls whether a Makoo module registers on the current URL after the script has loaded.
- `injectAt`: selects the DOM target where the component should mount.

Do not encode URL rules in `injectAt`. Do not use DOM selectors as a substitute for module `match`.

## Use `alive` And `timeout` Deliberately

Keep defaults unless the page behavior requires a change:

- Use `timeout` when the target node appears late.
- Use `alive` when the host page removes and rebuilds the target node and the injection must recover.
- Keep `alive: false` for stable targets or body-mounted floating UI that controls its own visibility.
- Prefer `scope: 'local'` unless the target can reappear anywhere in the document.

Do not use `timeout` as a retry loop. Do not enable `alive` everywhere by default.

## Keep Runtime Setup Small

Use `runtime.setup` only for project-level side effects that must run before injector setup, such as global polyfills, shared styles, or framework/plugin registration required by the whole userscript.

Do not put module-specific UI behavior, DOM mounting, or feature logic in runtime setup. If behavior belongs to one injected feature, keep it in that module.

## Refactoring Manual DOM Injection

When you find manual `document.querySelector` + `appendChild` + framework mount code as the main flow, refactor toward Makoo:

1. Create or identify an injection module under `injections/<module-name>/`.
2. Move UI rendering into `app.tsx`, `app.jsx`, or `app.vue`.
3. Add or update `injections/manifest.ts` with `defineInjections()`.
4. Put the target selector in `injectAt`.
5. Put URL filtering in module `match` or `monkey.userscript.match`.
6. Let Makoo choose and apply the React/Vue adapter.
7. Use `alive` or `timeout` only if the host page behavior requires it.

## Review Checklist

Before finishing work in a Makoo-powered project, check:

- No manual `querySelector` + `appendChild` flow is used as the primary injection mechanism.
- `defineInjections()` is used for injection registration.
- Manifest files describe injection config, not UI implementation.
- Component logic lives in `app.tsx`, `app.jsx`, `app.vue`, or module-local framework files.
- React/Vue mounting is handled by Makoo adapters.
- Vue plugins, when needed, are registered through `VuePlugin` from a `runtime.setup` file.
- Component-only edits rely on Vite HMR.
- Manifest, hooks, config, and runtime setup changes are treated as structural changes.
- `match`, `injectAt`, `alive`, and `timeout` are used for their distinct responsibilities.
