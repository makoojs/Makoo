# HMR is left entirely to Vite; Makoo does no hot-update cleanup

Makoo's Core, CLI (including the `makooDev` plugin and the dev bridge wrapper layer), and create-makoo templates do not handle HMR: they do not generate a self-accepting entry, do not write `import.meta.hot.accept` / `import.meta.hot.dispose`, and do not rewrite user modules to destroy the old Core Instance before a hot update. When the entry or its non-component dependencies change, Vite does a full page reload; component changes are handled in place by the Vue / React HMR boundaries respectively, without re-running `createMakoo()`.

This decision was made because, after checking the source code and documentation of Vite 8, vite-plugin-monkey, `@vitejs/plugin-vue`, and `@vitejs/plugin-react`, the case of "a hot update causes `createMakoo` to re-run and Injections to mount twice" simply does not happen on the default path:

- Vite's server-side `propagateUpdate` walks up the importers looking for an accepting boundary; the entry module has no importer and is not self-accepting, so it is a dead end, and a `full-reload` is sent, upon which the client runs `location.reload()`.
- In dev mode, the `__vite-plugin-monkey.entry.js` injected by vite-plugin-monkey first imports `/@vite/client` and then imports the user entry. So the `location.reload()` above reloads the host web page itself: the old page is destroyed together with the old Core Instance, and the new page has only one new instance.
- Vue SFCs are made self-accepting by plugin-vue injecting `import.meta.hot.accept(mod => __VUE_HMR_RUNTIME__.rerender/reload(...))`, so the update stops inside the component module and does not reach the entry. React Fast Refresh refreshes in place only when a module exports only components; once a non-component is exported, `validateRefreshBoundaryAndEnqueueUpdate` invalidates, and the update keeps propagating up to the entry, which still results in a full page reload.
- According to the Vite docs, `hot.dispose` only runs on self-accepting modules or accepted modules. Makoo's entry is neither, so even if `dispose` were written, it would not be called.

The repository history reached the same conclusion: `40490ab` (refactor: narrow cli responsibilities) removed the CLI-generated self-accepting entry with `accept` + `dispose(destroyAll)`; `6d571d5` (fix(create-makoo): remove redundant HMR cleanup) removed the redundant `dispose` from the templates.

## Considered Options

- **Track an owner per module and destroy the old instance before a hot update** (implemented in cli-dev-bridge ticket 03, later reverted): `transform` inserts a top-level `await __makooRenewOwner()` at the start of every module that imports a Core value, then generates an owner virtual module for each importer, which disposes the previous round's runtime before the module re-executes. Rejected: only modules where users wrote `import.meta.hot.accept` themselves would go down this path, and the default path does not use it; yet the cost is rewriting all user code, introducing top-level await, and adding an extra kind of virtual module.
- **Write `import.meta.hot.dispose` in the template entry**: the entry is not an accepting boundary, so `dispose` never fires; it is dead code that misleads users (see `6d571d5`).
- **Have the CLI generate a self-accepting entry and take care of accept + destroy itself**: this replaces the full page reload with a set of hot-replacement semantics maintained by Makoo, and side effects on the host page (DOM, global listeners) cannot be reliably rolled back (see `40490ab`).

## Consequences

- Before any agent or contributor adds HMR cleanup, `hot.dispose`, or owner / generation tracking to Makoo, they must first present a reproducible problem on the default path and revise this ADR; it must not be added on intuition.
- If a module where users wrote `import.meta.hot.accept` themselves (a self-built HMR boundary) creates a Core Instance, cleanup is the user's own responsibility by calling `dispose()` in `import.meta.hot.dispose`; Makoo does not do it for them.
- From the dev bridge's point of view, a full page reload is just the old page's devframe connection closing (its rows leave the `RuntimeStore`) followed by the new page connecting and submitting its whole table; the store does not need a concept of "runtime generation change within the same client".
- The page-side instrument (`packages/cli/src/bridge/runtime.ts`) only reads Status Handle and Instance Observation and reports them; it does not start, stop, or remove Injections.
