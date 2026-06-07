# HMR Behavior

Makoo separates two kinds of development updates:

- regular component updates, which Vite already handles well
- structural updates, where Makoo must rescan manifests and regenerate the virtual runtime
  entry

This separation keeps component editing fast while still making manifest and module
structure changes visible during development.

## Update Types

| Change | Behavior |
| --- | --- |
| Vue or React component file changes | Handled by Vite framework HMR |
| Top-level `injections/manifest.ts` changes | Makoo rescans and updates the virtual entry |
| Local dependency imported by the top-level manifest changes | Makoo rescans and updates the virtual entry |
| Module-level `injections/<module>/manifest.ts` changes | Makoo rescans and updates the virtual entry |
| Module-level manifest is added or removed | Makoo rescans and updates the virtual entry |
| `runtime.setup` file changes | Makoo rescans and updates the virtual entry |
| Local dependency imported by a setup file changes | Makoo rescans and updates the virtual entry |
| Third-party package dependency changes | Not tracked by Makoo structural scanning |

## Structural Updates

A structural update is any change that can alter the generated injection entry. Examples
include:

- adding a module-level `manifest.ts`
- removing a module-level `manifest.ts`
- changing a module's `injectAt`
- changing a module's `component`
- toggling `enabled`
- changing `match`, `alive`, `scope`, `timeout`, or `hooks`
- changing a local helper imported by a manifest
- changing a `runtime.setup` file

When Makoo detects a structural update, it rescans the project, invalidates the virtual
module, and sends a Vite HMR update for the generated entry.

## Component Updates

Component files are intentionally left to Vite and the framework plugin:

```txt
injections
└─ hello-world
   ├─ app.vue       <- Vue HMR
   ├─ app.tsx       <- React HMR
   └─ style.css     <- Vite CSS update
```

Editing a component should not require Makoo to rescan the manifest. This keeps normal UI
iteration close to the default Vite experience.

## Dependency Tracking

Makoo tracks local static imports from manifest and setup files.

```ts
// injections/manifest.ts
import { profileHooks } from './profile-hooks';

export default defineInjections({
	globalInjector: {
		hooks: profileHooks
	},
	injections: {
		profile: {
			injectAt: '.profile',
			component: './profile/app.vue'
		}
	}
});
```

Changing `profile-hooks.ts` triggers a structural update because it is a local dependency of
the manifest.

Makoo does not track every possible dependency shape. Prefer static relative imports for
manifest and setup dependencies:

```ts
import { hooks } from './hooks';
```

Makoo is still early, and dependency tracking is intentionally limited for now. Try not to
rely on structural HMR for:

- dynamic `import()` in a manifest dependency chain
- path aliases that Makoo cannot resolve as local files
- third-party packages imported by manifest helpers

If those dependencies affect the generated runtime, restart the dev server after changing
them.

## Watch Scope

During dev mode, Makoo watches:

- the loaded top-level manifest file
- local dependencies collected from the top-level manifest
- local dependencies collected from `runtime.setup`
- module-level manifest files for enabled modules
- the `injections/` directory, so added or removed module manifests can be detected

It does not treat every file under `injections/` as structural. A regular component change
is returned to Vite's normal HMR pipeline.

## Errors During Rescan

If a rescan fails, Makoo sends the error through Vite's dev error overlay when a dev server
is available. Common causes include:

- missing `injections/manifest.ts`
- invalid manifest shape
- missing component file
- unknown component framework extension
- no enabled injections after filtering
- missing `runtime.setup` file

Fix the manifest or setup file and save again; Makoo will try to rescan on the next relevant
change.

## When To Restart

Most manifest and component edits should update without restarting. Restart the dev server
when you change something outside Makoo's structural watch model, such as:

- installing or upgrading dependencies
- changing Vite plugins
- changing unsupported `vite-plugin-monkey` integration details
- relying on a third-party helper imported by a manifest dependency
- editing files reached only through dynamic imports or unresolved aliases

The rule of thumb: if the change affects Vite itself, package resolution, or dependencies
Makoo cannot statically collect, restart the dev server.
