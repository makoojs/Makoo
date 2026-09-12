---
"@makoojs/create-makoo": minor
"@makoojs/core": minor
"@makoojs/cli": minor
"@makoojs/react": patch
"@makoojs/vue": patch
---

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
