---
name: makoo-framework-development
description: Use when developing the Makoo framework/monorepo itself, especially when changing packages/core, packages/cli, packages/react, packages/vue, packages/create-makoo, repository config, tests, package APIs, adapters, or internal documentation. Do not use for ordinary downstream projects that only consume Makoo.
---

# Makoo Framework Development

Follow this skill when developing Makoo itself: the framework monorepo, its packages, adapters, CLI, scaffolding templates, tests, docs, or shared configuration. Preserve the repo's current library-first architecture, naming, and testing style instead of introducing generic app-framework patterns.

Do not use this skill for ordinary downstream projects that only use Makoo to build userscripts. For task composition and injection module work in a Makoo-powered project, use the Makoo injection workflow skill instead.

## Start Here

Identify the target package before editing:

- `packages/core`: framework-agnostic runtime core
- `packages/cli`: config resolution, Vite and userscript integration, project commands
- `packages/react`: React adapter only
- `packages/vue`: Vue adapter and Vue plugin registration
- `packages/create-makoo`: project scaffolding templates

Keep code inside the package that already owns the responsibility.

If the task touches multiple areas or you need a fuller package map, read `references/project-map.md`.

## Build, Test, And Dev Commands

Prefer this repo's package-manager scripts for install, build, test, lint, and docs work. Do not invoke tools by reaching into `node_modules` and calling package JS files directly. For adding or removing dependencies, use `pnpm` commands; do not hand-edit `package.json` or lockfiles to change deps.

- `pnpm install`: install dependencies from the lockfile.
- `pnpm build`: build all publishable packages into their `dist/` outputs.
- `pnpm build:core` / `pnpm build:cli` / `pnpm build:react` / `pnpm build:vue` / `pnpm build:create-makoo`: build one package when the change is scoped.
- `pnpm test`: run the Vitest suite (`packages/*/test/**/*.test.ts`).
- `pnpm test:watch`: run Vitest in watch mode during local iteration.
- `pnpm test:coverage`: run Vitest with coverage.
- `pnpm lint`: run Biome format, lint, and import checks.
- `pnpm lint:fix`: apply safe Biome autofixes.
- `pnpm format`: write Biome formatting only.
- `pnpm docs:dev` / `pnpm docs:build`: work on the docs website when docs are in scope.
- Run a single test file or directory with `pnpm exec vitest run packages/cli/test/vite/makooDev.test.ts` (adjust the path). Prefer the smallest relevant target before a full `pnpm test`.

Do not run `pnpm exec tsc -p packages/*/tsconfig.json` or similar package-level `tsc -p` commands as routine verification: those package tsconfigs emit `.d.ts` files into source directories. Prefer Vitest, targeted runtime checks, or the package's actual build pipeline instead.

## Non-Negotiable Style Rules

- Write TypeScript with ESM imports and exports.
- Match the repository formatter: tabs for indentation, single quotes, semicolons, no trailing commas, and a soft line width around 100 characters. Biome owns formatting and lint.
- Prefer named exports. Use barrel exports only in package entrypoints such as `src/index.ts`.
- Keep filenames and directories descriptive and consistent with the existing package vocabulary. Use `PascalCase` for classes and class-like files, `camelCase` for functions and builders, and `types.ts` for tightly related type groups. Tests live under the package-local `test/` directory and follow the target name, such as `resolve.test.ts` or `makooDev.test.ts`.
- Keep focused changes focused. Do not casually edit unrelated packages, generated outputs, scaffold templates, docs, or release metadata while handling a narrow task.
- Add comments only when they explain intent, invariants, or subtle behavior. Do not narrate obvious code.

## Documentation Rules

- Write public README and documentation-site content as a description of the current framework: supported APIs, observable behavior, usage, constraints, and examples.
- Keep implementation history and migration rationale in changesets, changelogs, ADRs, commit messages, or pull-request descriptions. Do not turn user documentation into a record of superseded technical decisions.
- Describe current behavior positively and in terms users already know. For example, write "hooks and callbacks may be declared inline or imported from browser-compatible files" rather than explaining an old serialization mechanism.
- Prefer public field and API names over invented umbrella terms. Do not introduce labels such as "runtime functions" when the documentation can name `hooks`, `callback`, and `activitySignal` directly.
- Keep internal config resolution and plugin wiring details in architecture or internal CLI documentation unless a user must understand them to use or debug a documented feature. In usage guides, explain the observable result and the required user action.
- Use negative wording when it communicates a current user-facing requirement or boundary, such as an unsupported import or an unnecessary setup file. Do not use it merely to contrast the current architecture with an abandoned internal approach.
- When the user edits one language of paired documentation, treat that edited version as the source for the requested synchronization. Preserve its meaning and structure, then update the other language without rewriting the user's source text beyond necessary correctness fixes.
- Before finishing a documentation change, scan the affected public docs for stale migration language such as `now`, `no longer`, `formerly`, `instead of the old`, `不再`, `以前`, or comparisons with a removed mechanism. Review matches in context rather than replacing unrelated prose blindly.

## Structure Conventions

- Place implementation near its domain. Examples already used in the repo:
  - runtime orchestration in `Makoo/`, `runtime/`, `Task/`, `watcher/`, `payload/`
  - adapter contracts in `adapter/` or package-local adapter files
  - configuration defaults, validation, and resolution in `config/`
- Add new subdirectories only when they create a real domain boundary, not for one-off indirection.
- Keep entrypoints minimal. Re-export public API from `src/index.ts`; do not hide substantial logic there.
- Keep package public APIs explicit. If a symbol is not meant to be public, avoid exporting it from the package entrypoint.

## Naming And API Design

- Use domain terms that already exist in the repo: `inject`, `listen`, `register`, `resolve`, `normalize`, `build`, `observe`, `watch`, `adapter`, `task`, `config`.
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

## Avoid Fallbacks And Over-Engineering

Keep engineering restrained. Engineering should reduce complexity, unify constraints, and improve maintainability. It should not invent abstraction layers, generic frameworks, complex configuration, or unused extension points just to look architecturally complete. Prefer the simplest clear implementation that solves the current, concrete need. Abstract or generalize only after real repetition appears and the boundary has stabilized.

Also avoid protective over-fallback: do not paper over missing values with ternaries, defaults, `??`, optional chaining, or recovery branches that force variables to "always exist." When data is required by the contract or domain, missing data is already an abnormal state. Validate close to the source and fail explicitly instead of masking the problem so it spreads downstream as a harder-to-debug failure.

Fallback policy:

- Do not add preventive fallback branches, fallback values, or compatibility code by default.
- Add fallback logic only when runtime constraints, public API semantics, or an existing local package pattern clearly require it.
- Before adding fallback logic, inspect the current package for an existing implementation or handling pattern with the same purpose.
- Only add new fallback logic when no suitable package-local precedent exists.
- If the surrounding code prefers explicit failure over silent recovery, preserve explicit failure.

## Function Splitting And Recursion

Keep simple, continuous control flow intact. Do not mechanically split a main function into private helpers just to shorten it. Helpers that are called once, only wrap a few expressions or forward arguments, and have no independent domain meaning should stay inline. Do not fill a file with tiny helpers that force readers to jump around. "Single responsibility" does not mean "one or two lines per function." Extract a function only when it is reused, names a real domain concept, contains a complex algorithm worth isolating for tests, or materially removes duplication or nested branching.

Never declare a recursive function inside another function. Lift recursive traversal to a module-level named function or a dedicated module, and pass context and accumulators explicitly through parameters instead of hiding data flow in outer closures. Recursive function names must say what is traversed and why, such as `collectWatcherTargets` or `traverseAdapterTree`. Do not use context-free names like `walk`, `process`, `handle`, or `recurse`.

## Testing Rules

- Add or update Vitest coverage for behavior changes.
- Place tests in the package-local `test/` directory and keep filenames aligned with the target unit or feature.
- Match current test style: `describe` and `it`, straightforward fixture setup, explicit expectations, and `vi.spyOn` for interaction testing.
- Test observable behavior and normalization results, not private implementation trivia, unless the repo already exposes internals for that pattern.
- For config and resolver work, assert concrete output shape and edge cases.

## CLI Config Rules

- Keep `entry`, app metadata, and monkey options semantically separated in resolved config.
- Resolve the configured application module relative to the project root and pass it to `vite-plugin-monkey`.

## Release And Changesets

- Treat changesets as a separate, explicitly authorized release action. Never create, edit, or
  delete a changeset unless the user directly asks for changeset work. Do not infer permission
  from an implementation request, bug fix, breaking API change, documentation update, request to
  commit, or the fact that a published package is affected. When a change appears to need a
  changeset but the user did not request one, complete the requested work without generating it.
- Makoo uses Changesets for published package versioning and changelogs.
- Published packages maintain package-level changelogs under `packages/*/CHANGELOG.md`.
- The root `CHANGELOG.md` is a legacy project-level archive, not the current release changelog source.
- Do not manually edit package versions except in Changesets-generated version PRs.
- The release workflow is `.github/workflows/changesets-release.yml`: it creates a `Version Packages` PR first, then publishes after that PR merges.
- Publish from Actions with npm trusted publishing (OIDC). Keep `id-token: write` on the release job, do not pass `NPM_TOKEN` or `NODE_AUTH_TOKEN` into publish steps, and do not use `npm whoami` as an auth check. Configure a GitHub Actions trusted publisher on each published package at npmjs.com, using workflow filename `changesets-release.yml`.
- If Actions cannot create the version PR, check repository or organization workflow permissions for pull request creation before changing release code.

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
