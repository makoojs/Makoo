# @makoojs/core

## 0.4.0

### Minor Changes

This release narrows Makoo to one workflow: **compose runtime tasks in application code, then point `makoo()` at that module to produce a userscript.** The CLI no longer scans manifests, generates entries, or provides `makoo inspect`. During development, `makoo dev` can show the tasks actually running in the browser; use `makoo preview` to preview a build.

The docs site and `create-makoo` scaffolds follow the same workflow. Projects still on the manifest / inspect toolchain need to change their entry and Vite config — bumping versions is not enough.

**Highlights**

- CLI keeps only `makoo dev` / `makoo build` / `makoo preview`, and forwards common Vite flags
- Projects use `makoo({ entry, app, monkey })`; `name` / `version` / `description` come from `app` only
- Optional `makooDev()`: the `makoo dev` terminal can inspect tasks on connected runtimes
- core / React / Vue keep original error details when something fails
- Scaffolds, docs, theme, and the release CI catch up with the same workflow

---

- Narrow `@makoojs/cli` to Vite / userscript integration only: remove manifest scanning, code generation, `makoo inspect`, and the old virtual-entry toolchain.
- Require `monkey` on `makoo()` / `CliConfig`. Empty `monkey: {}` is still valid.
- `monkey.userscript` can no longer set `name`, `version`, or `description`. Those fields come from `app` only; values in `monkey` are overwritten.
- Keep CLI commands as thin Vite wrappers: `makoo dev`, `makoo build`, and `makoo preview`.

- Add `makoo preview` for previewing the built userscript.
- Forward common Vite CLI flags through `makoo dev` / `build` / `preview` (for example `--host`, `--port`, `--open`, `--config`, `--mode`, `--watch`).
- Add `makooDev()` (`serve` only): send Makoo runtime events from the browser to the dev server. Add this plugin explicitly in the Vite config; production builds still use the real `@makoojs/core`.
- `makoo dev` provides an interactive terminal in a TTY: home, task table, logs, and help. It can show task status on connected runtimes (id / kind / status / injectAt). Without `makooDev()`, behavior stays ordinary Vite development.
- Keep `@makoojs/cli/monkey` as the stable GM API surface and continue re-exporting `cdn`.

- Reorganize the package by runtime boundaries: `cli/`, `config/`, `vite/`, and `monkey/`, and add `session/` for this release (dev-time runtime snapshots; not included in production builds).
- Move vite-plugin-monkey option adaptation into `config/resolve.ts` (no longer `vite/toMonkeyOptions.ts`).
- Own CLI config error codes locally instead of importing them from `@makoojs/core`.
- Align the public `MakooOptions` type with `CliConfig`, and export `makooDev`.

- Align package README and docs-site CLI pages with the narrowed workflow.
- Document `makooDev()` and runtime task inspection in `makoo dev`.

---

- Normalize Makoo error output with `summary`, `context`, `withContext()`, and `formatMakooError()`.
- Remove CLI-owned `ErrorCode` values from core; CLI config errors now live in `@makoojs/cli`.
- Add task cleanup / hook error codes used by the narrowed runtime surface.

- Preserve existing `MakooError` context when adapter unmount, signal bind, or hook execution fails, instead of wrapping and dropping the original error details.
- `destroyAll()` now `destroy()`s each registered task, instead of only disabling alive observers and clearing the context.

---

- Preserve the original mount / unmount failure as `cause` on `ReactAdapterError`, so adapter failures keep their underlying stack and message.

- Align the React README with the narrowed Makoo workflow.

---

- Preserve the original mount / unmount failure as `cause` on `VueAdapterError`, so adapter failures keep their underlying stack and message.

- Align the Vue README with the narrowed Makoo workflow.

---

- Update React and Vue scaffolds for the narrowed CLI workflow: application entry + `makoo({ entry, app, monkey })`, without the old manifest / inspect toolchain.
- Add a `preview: 'makoo preview'` script to the scaffold, and bump template dependency versions.

- Remove the redundant `import.meta.hot.dispose(() => tasks.destroyAll())` from the templates. Scaffolds no longer hand-write HMR teardown.

- Refresh the Makoo logo assets used by the scaffolder.

---

- Align guides and API docs with the narrowed workflow, and add pages for the CLI dev terminal and runtime task inspection.
- Restyle the docs site with the vermilion brand, and redo the homepage, navigation, and search layout.
- Switch publishing to npm Trusted Publishing (OIDC). Refresh project logo assets.

---

If you are coming from a version that still uses manifests / `makoo inspect`, you need to do at least the following:

1. **Move the entry into application code.** Compose tasks with `createMakoo(...).start([inject(...) / listen(...)])`. Do not rely on CLI scanning or generated entries.
2. **Change the Vite config to** `makoo({ entry, app, monkey })`. `monkey` is required. Put the script `name`, `version`, and `description` on `app`.
3. **Remove dependencies on** `makoo inspect`, `@makoojs/cli/manifest`, **and the old virtual-entry toolchain.**
4. **Add a** `preview` **script** (`makoo preview`). `dev` / `build` / `preview` can take Vite flags directly, for example `makoo dev --host --port 5173`.
5. **To inspect runtime tasks in the terminal,** add `makooDev()` to the Vite plugin list yourself. The scaffold does not add it by default, and production builds do not include this plugin.

New project:

```bash
npm create makoo@latest
```

Existing project (fill in versions after the changeset):

```bash
npm i -D @makoojs/cli @makoojs/core
npm i @makoojs/react
npm i @makoojs/vue
```

Docs: <https://makoojs.github.io/Makoo/>

## 0.3.1

### Patch Changes

Add a capture option to listener injection so that operations can be performed during the capture phase.

## 0.3.0

### Minor Changes

This release completes the full Makoo pipeline—from manifest declarations and project scanning to runtime code generation, browser execution, and structural HMR.

Manifest `hooks`, `callback`, and `activitySignal` functions now enter Vite’s module graph as real module references. They can use variables, closures, and statically imported functions from their original modules without losing runtime context.

Makoo also adds standalone listeners that do not belong to a component, while preserving automatic scanning, virtual entry generation, and task startup.

- `@makoojs/core`: `0.3.0`
- `@makoojs/cli`: `0.4.0`
- `@makoojs/react`: `0.1.3`
- `@makoojs/vue`: `0.1.3`
- `@makoojs/create-makoo`: `0.1.7`

- Declare standalone listeners in the top-level manifest
- Preserve module scope and lexical closures for hooks, callbacks, and activity signals
- Automatically track manifests and their static local dependencies
- Support URL matching, enabled state, and activity signals for standalone listeners
- Display resolved listeners in `makoo inspect`
- Standardize `inject()` and `listen()` on object inputs
- Add the browser-safe `@makoojs/cli/manifest` entry point
- Improve merging between root and module-level manifests
- Align structural HMR logs with Vite’s terminal format
- Rewrite and synchronize the Core, CLI, React, and Vue API documentation in English and Chinese

Top-level manifests can now declare event tasks that do not belong to a component:

```ts
import { defineInjections } from "@makoojs/cli/manifest";

export default defineInjections({
  listeners: {
    escapeClose: {
      listenAt: "body",
      type: "keydown",
      callback: (event) => {
        if (event instanceof KeyboardEvent && event.key === "Escape") {
          closePanel();
        }
      },
      match: ["https://example.com/*"],
    },
  },
});
```

In object-form manifests, the entry key becomes a stable `listenerId`.

Standalone listeners support:

- `listenAt`
- `type`
- `callback`
- `activitySignal`
- `enabled`
- `match`

Listener-only projects no longer need to declare an empty `injections` collection.

Functions declared or imported by a manifest are now referenced through real imports in the generated entry:

```ts
import { defineInjections } from "@makoojs/cli/manifest";
import { onEscape } from "./listeners/onEscape";
import { panelHooks } from "./hooks/panelHooks";

export default defineInjections({
  injectionDefaults: {
    hooks: panelHooks,
  },
  listeners: {
    escapeClose: {
      listenAt: "body",
      type: "keydown",
      callback: onEscape,
    },
  },
});
```

`onEscape` and `panelHooks` can use variables, functions, and static imports from the modules where they are declared.

Vite keeps these files in its module graph and updates the generated runtime entry when their structural dependencies change.

When a module-level manifest and the root manifest declare the same module ID, Makoo shallow-merges their top-level fields:

- Fields explicitly declared by the module manifest take priority
- Fields omitted by the module may come from the same-ID root injection
- `hooks` and `on` each select one complete source instead of being deeply merged
- Injections declared only by module manifests are added to the final task list

This allows shared configuration to remain in the root manifest while each module continues to own its component path and injection target.

Makoo now tracks:

- The root manifest
- Module-level manifests
- Local files statically imported by manifests
- Local dependencies used by hooks, callbacks, and activity signals
- `runtime.setup` files
- Static local dependencies imported by runtime setup files

When a structural dependency changes, Makoo rescans the project, updates the virtual entry, and restarts the affected runtime tasks.

Terminal output now follows Vite’s visual structure:

```text
1:10:16 AM [makoo] (client) hmr update runtime-dependency: src/runtime/example.ts
```

The `[makoo]` label uses a distinct deep-pink color so Makoo and Vite messages remain easy to distinguish.

Regular Vue, React, and CSS files are still handled by their corresponding Vite HMR plugins and do not trigger a manifest rescan.

This release also improves CLI observability and error boundaries:

- Scanner results now include the final enabled injections and listeners
- `makoo inspect` includes a dedicated Listeners section
- Disabled tasks are excluded from generated runtime bindings
- Makoo reports a clear error when no enabled injection or listener remains
- Manifest binding, manifest import, and function-reference failures use dedicated error types
- CLI errors consistently inherit from `MakooError` and include stable error codes and structured issue paths

Manifest helpers and their related types are now exported from the browser-safe manifest entry:

```diff
- import { defineInjections } from '@makoojs/cli';
+ import { defineInjections } from '@makoojs/cli/manifest';
```

For module-level manifests:

```diff
- import { defineInjection } from '@makoojs/cli';
+ import { defineInjection } from '@makoojs/cli/manifest';
```

```diff
- inject('#app', Panel, options);
+ inject({
+   injectAt: '#app',
+   artifact: Panel,
+   options
+ });
```

```diff
- listen('body', 'keydown', onKeydown, {
-   activitySignal
- });

+ listen({
+   listenAt: 'body',
+   type: 'keydown',
+   callback: onKeydown,
+   activitySignal
+ });
```

`MakooListenerOptions` has been removed. Declare `activitySignal` directly on `MakooListenerInput`.

Manifests are loaded during Node-based scanning, while their hooks and callbacks also become part of the browser runtime. Therefore:

- Keep top-level manifest evaluation declarative and free of application side effects
- Do not import Node-only modules such as `node:fs` or `node:path`
- Ensure hooks, callbacks, activity signals, and their dependencies can be bundled for the browser
- Prefer static relative imports so Makoo can track dependencies and structural HMR updates

Standalone listeners are currently supported only in the root manifest. Events that belong to a component task should continue to use the injection’s `on` field.

The documentation site and package READMEs have been reorganized around the public API and synchronized in English and Chinese:

- Core API
- CLI API
- React API
- Vue API
- Manifest
- HMR
- Configuration
- Getting Started
- Recipes

## 0.2.2

### Patch Changes

🐛 Preserve Inferred Fallback Injection IDs

`@makoojs/core` now preserves inferred fallback injection task ids when the original base task has been destroyed.

Previously, if two different artifacts shared the same artifact name and injection target, the second artifact could receive a fallback task id. If the base task was later destroyed while the fallback task remained active, registering the second artifact again could move it back to the base id and mount the same artifact twice.

Makoo now checks for a live fallback task for the same artifact before reusing the base id, so repeated registrations continue to resolve to the existing fallback task and are correctly treated as duplicates.

## 0.2.1

### Patch Changes

Patch Changes

✨ New Object-Form Injection API

`@makoojs/core` now supports object-form `inject()` declarations.

You can continue using the existing positional form: `inject('#toolbar', Toolbar, options)`.

Or use the new object form when you want to keep declaration fields together or provide a stable task id: `inject({ id: 'toolbar', injectAt: '#toolbar', artifact: Toolbar, options })`.

The optional `id` is used as the task id, making later task lookup and control easier through APIs such as `started.get(...)`, `reset(...)`, and `destroy(...)`.

🐛 Safer Inferred Injection Task IDs

Core now avoids false duplicate detection when different artifacts share the same artifact name and target selector.

Previously, two different components with the same name, such as multiple `App.vue` files injected into `body`, could resolve to the same inferred task id and cause the second task to be skipped as a duplicate.

Makoo now keeps duplicate skipping for the same artifact reference, while assigning fallback task ids when different artifacts would otherwise collide.

Patch Changes

🔧 CLI Uses Module IDs As Injection Task IDs

`@makoojs/cli` now generates object-form `inject()` declarations and passes each resolved module id as the task id.

This makes generated runtime tasks stable and prevents same-named components from colliding at runtime, for example `inject({ id: 'profile-panel', injectAt: 'body', artifact: Injection_profile_panel, options })`.

📚 Documentation

Updated the core README and docs website API pages to show both `inject()` forms and explain when the object form is useful.

## 0.2.0

### Minor Changes

## 🚨 Breaking Changes

`@makoojs/core` now uses a declaration-based runtime API centered on `createMakoo()`, `inject()`, `listen()`, and `makoo.start(...)`.

The old public `Injector` facade has been removed. If you previously created an injector instance and called `register()` / `registerListener()` / `run()`, migrate to declaring tasks first and starting them as a batch:

## ✨ New Runtime API

The new API separates declaration from execution:

- `createMakoo()` creates the runtime.
- `inject()` declares a component injection task.
- `listen()` declares a listener task.
- `makoo.start([...])` registers and starts a batch of declarations.
- `start()` returns `StartedTasks` for controlling the tasks created by that batch.

## 🧩 New Runtime Types

This release also exposes the new runtime-facing types, including:

- `MakooRuntime`
- `StartedTasks`
- `MakooTaskDeclaration`
- `MakooInjectionDeclaration`
- `MakooListenerDeclaration`
