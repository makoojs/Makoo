# Makoo Project Map

Use this file when a change spans packages, adds files, or needs a check on where code should live.

## Package Responsibilities

- `packages/core`: framework-agnostic runtime. `CONTEXT.md` defines its vocabulary.
  - `core/`: `createMakoo`, the declaration batch, Injection registration, and disposal.
  - `component/` and `listener/`: declarations, Commands, Status, and executions for Components and Host Listeners (`listener/attach.ts` holds Attached Listeners).
  - `dom/`: the shared DOM observer, `waitForElement`, and `watchElement`.
  - `adapter/`: the Component Adapter contract and registry.
  - `state/`: StateView. `error/`: `MakooError`, `MakooAggregateError`, and `MakooErrorCode`.
- `packages/cli`: config parsing and resolution (`config/`), project commands (`cli/`), the Vite plugin (`vite/`), the dev session (`session/`), and `monkey/` aliases over userscript manager APIs.
  - Keep `entry`, application metadata, and monkey options separate in resolved config.
  - Resolve the configured application module relative to the project root before passing it to `vite-plugin-monkey`.
- `packages/react`, `packages/vue`: framework-specific mount and unmount, hooks or composables, framework-facing errors and type guards. Vue also owns plugin registration.
- `packages/create-makoo`: starter templates and scaffold-time file content.

## Recurring File Patterns

- `index.ts`: re-exports the public package API only.
- `types.ts`: type definitions next to their domain.
- `declaration.ts` (core) or `resolve.ts` / `validation.ts` (cli): validate and normalize user input at the boundary.
- `defaults.ts`: shared default values, regexes, constants, and fixed identifiers.
- `error.ts`, `errors.ts`, or `XError.ts`: domain failures with stable messages and codes.

## Package-Level Test Focus

- Core tests use real DOM fixtures and drive lifecycle transitions and reentry through Commands and Status.
- Adapter tests cover mount and unmount success and wrapped failure behavior.
- CLI tests cover config transformation, command behavior, and Vite plugin options.
- Template tests check that the generated project matches the current public API.
