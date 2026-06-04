---
name: makoo-project-style
description: Keep code changes aligned with the Makoo monorepo's TypeScript library and CLI conventions. Use when creating or editing files in this repository, especially under packages/core, packages/cli, packages/react, packages/vue, packages/create-makoo, or shared config files, and when an agent needs guidance on project structure, naming, exports, testing, errors, or formatting.
---

# Makoo Project Style

Follow this skill when changing code in the Makoo repository. Preserve the repo's current library-first architecture, naming, and testing style instead of introducing generic app-framework patterns.

## Start Here

Identify the target package before editing:

- `packages/core`: framework-agnostic runtime core
- `packages/cli`: config resolution, scanning, code generation, Vite plugin integration
- `packages/react`: React adapter only
- `packages/vue`: Vue adapter and Vue plugin helpers
- `packages/create-makoo`: project scaffolding templates

Keep code inside the package that already owns the responsibility. Prefer extracting shared runtime behavior into `core` rather than duplicating it in adapters or CLI code.

If the task touches multiple areas or you need a fuller package map, read `references/project-map.md`.

## Non-Negotiable Style Rules

- Write TypeScript with ESM imports and exports.
- Match the repository formatter: tabs for indentation, single quotes, semicolons, no trailing commas, and a soft line width around 100 characters.
- Prefer named exports. Use barrel exports only in package entrypoints such as `src/index.ts`.
- Keep filenames and directories descriptive and consistent with the existing package vocabulary. Use `PascalCase` for classes and class-like files, `camelCase` for utility and builder files, and `types.ts` for tightly related type groups.
- Keep functions small and explicit. Favor clear local helpers over clever abstractions.
- Add comments only when they explain intent, invariants, or subtle behavior. Do not narrate obvious code.

## Structure Conventions

- Place implementation near its domain. Examples already used in the repo:
  - runtime orchestration in `Task/`, `Injector/`, `watcher/`, `payload/`
  - adapter contracts in `adapter/` or package-local adapter files
  - configuration defaults, validation, and resolution in `config/`
  - code generation split into `render/import`, `render/init`, and `render/run`
- Add new subdirectories only when they create a real domain boundary, not for one-off indirection.
- Keep entrypoints minimal. Re-export public API from `src/index.ts`; do not hide substantial logic there.
- Prefer pure helper functions for normalization, derivation, and transformation code.
- Keep package public APIs explicit. If a type or helper is not meant to be public, avoid exporting it from the package entrypoint.

## Naming And API Design

- Use domain terms that already exist in the repo: `inject`, `register`, `resolve`, `normalize`, `build`, `render`, `observe`, `watch`, `adapter`, `manifest`, `config`.
- Name booleans and state transitions clearly, such as `enabled`, `alive`, `pending`, `active`, `idle`, `isSuccess`.
- Prefer `ResolvedX`, `XConfig`, `XResult`, `XError`, and `XOptions` naming for structured types.
- Keep defaults centralized in `defaults.ts`-style files when the values are shared or semantically important.
- Infer values when the package already follows that pattern, but fail with a specific error when ambiguity would be unsafe.

## Errors, Validation, And Logging

- Model library and CLI failures with specific error classes instead of ad hoc `Error` strings.
- When extending the repo's error style, include a stable error code and structured issue details when available.
- Preserve the existing `[makoo]` tone in surfaced errors and console messages.
- Validate config and user input close to the boundary. Normalized internal code should operate on resolved, typed data.
- Prefer returning normalized objects from resolver functions instead of mutating input.

## Fallback And Helper Function Rules

- Do not add preventive fallback branches, fallback values, fallback helpers, or compatibility code by default.
- Add fallback logic only when runtime constraints, business semantics, or an existing local package pattern clearly require it.
- Before adding fallback logic, inspect the current package for an existing implementation, utility, or handling pattern with the same purpose.
- Only add new fallback logic when no suitable package-local precedent exists.
- If the surrounding code prefers explicit failure over silent recovery, preserve explicit failure.
- When a small helper is needed, first check whether it can be inlined into the current function, method, or class implementation without harming readability or responsibilities.
- If a helper cannot be cleanly inlined, it may stay in the same file only when it is simple, local to that file, and does not blur the file's main responsibility.
- If helper logic becomes non-trivial, is reused, or starts to distract from the file's primary logic, extract it.
- When extracting a helper, prefer the current directory's existing `util` file. If none exists, create one that matches the repository's naming style and export the helper from there.
- Do not extract helpers prematurely for hypothetical reuse.
- Do not move one-off, short, context-heavy logic into `util` unless extraction materially improves clarity.

## Testing Rules

- Add or update Vitest coverage for behavior changes.
- Place tests in the package-local `test/` directory and keep filenames aligned with the target unit or feature.
- Match current test style: `describe` and `it`, straightforward fixture setup, explicit expectations, and `vi.spyOn` for interaction testing.
- Test observable behavior and normalization results, not private implementation trivia, unless the repo already exposes internals for that pattern.
- For generator, config, and resolver work, assert concrete output shape and edge cases.
- Do not run `pnpm exec tsc -p packages/*/tsconfig.json` or similar package-level `tsc -p` commands as routine verification because these package tsconfig files emit `.d.ts` files into source directories. Prefer Vitest coverage, targeted runtime checks, or the package's actual build pipeline instead.

## Change Workflow

When implementing a change, follow this sequence:

1. Read the nearest existing module and its sibling files before editing.
2. Extend the current pattern instead of introducing a new architectural style.
3. Update exports if the change affects package public API.
4. Run the smallest relevant tests first, then broader validation if needed.
5. Run formatting or lint fixes only if your changes need them.

## Avoid These Mismatches

- Do not introduce default exports into areas that already use named exports.
- Do not add framework-specific logic to `packages/core`.
- Do not move validation, defaults, and resolution concerns into one giant function when the package already separates them.
- Do not replace domain-specific errors with generic throws.
- Do not introduce React app, Next.js, or SPA-style patterns that do not fit a library and CLI monorepo.
- Do not broaden package public surface area unless the task requires it.

## References

- Read `references/project-map.md` for package responsibilities, file-layout patterns, and a practical edit checklist.
