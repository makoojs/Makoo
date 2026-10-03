---
name: makoo-framework-development
description: Guardrails for changing the Makoo framework monorepo itself: package source, public APIs, adapters, CLI, scaffold templates, tests, repository config, or internal docs. For userscript projects that only consume Makoo, use the Makoo injection workflow skill instead.
---

# Makoo Framework Development

Makoo is a pre-1.0, same-repository, lockstep-maintained project. Judge architecture, compatibility, and recovery costs at that scale rather than by the needs of a mature cross-team platform.

## Workflow

1. **Locate the owning boundary.** Read the target package's implementation, sibling files, tests, and public exports. For `packages/core`, read `CONTEXT.md` and use its terms. Read [references/project-map.md](references/project-map.md) when a change spans packages, adds files, changes public exports, or leaves ownership unclear. Done when you can name the package and file that own the change.
2. **Pass the current-need gate** (below) for every field, branch, guard, file, and abstraction you add. Done when each addition has a named current requirement and consumer.
3. **Implement** within the conventions below. For lifecycle, cancellation, recovery, or status-transition code in `packages/core` (`component/`, `listener/`, `dom/`), read [references/core-runtime.md](references/core-runtime.md) first.
4. **Test.** Done when every added or changed branch has a test that reaches it through public behavior and fails when that branch is removed.
5. **Verify**, smallest scope first:
   - `pnpm test <path>`
   - `pnpm exec tsc --noEmit -p packages/<pkg>/tsconfig.json` when types or signatures change (`--noEmit` keeps `.d.ts` files out of source directories)
   - `pnpm exec biome check <changed files>`
   - `pnpm build` when public APIs, exports, build output, or dependencies change
   - `pnpm docs:build` for documentation changes

   Done when each applicable check passes, or a failure is shown to be pre-existing.
6. **Review the tests.** When tests were added or changed, run `skills/makoo-test-review/SKILL.md` before finishing.

## Current-Need Gate

Design from Makoo's current requirements, consumers, and observed failure modes. Before adding anything, answer:

- What current behavior, constraint, or observed failure requires it?
- Which current consumer reads, calls, or enforces it?
- Why is explicit failure insufficient for this case?

With no current requirement and no current consumer, leave it out. A plausible future workflow is not a requirement, and an architectural label (such as "runtime session") does not by itself justify discovery, versioning, reconnection, or cross-version compatibility. Prefer the simplest implementation that satisfies the present contract; generalize after real repetition appears and the boundary has stabilized.

**Defensive code passes the same gate.** A guard, re-check, fallback, or flag needs a concrete trigger: the code path that makes its condition true, and the test that drives that path. A branch with no reachable trigger is dead code. Delete it instead of testing it.

**One fact, one owner, one representation.** Before adding a check, find the code that already owns that invariant and keep the check there. Derive state from its existing source rather than mirroring it. For example, cancellation is an `AbortSignal`, not a boolean kept beside it. Two checks that encode the same fact mask each other: removing either one changes nothing, so neither is protected by tests.

## Failure And Fallback Policy

Explicit failure is a valid design when automatic recovery is not part of the current contract. Validate required data close to its source and fail with a specific error. Defaults, `??`, optional chaining, recovery branches, or compatibility code must not mask an abnormal state.

Add fallback or recovery only when one of these requires it:

- a runtime constraint;
- public API semantics;
- an existing package-local behavior with the same purpose;
- an explicit user requirement or observed workflow.

When a design is challenged, reassess each part against current evidence. Remove unsupported completeness, and keep mechanisms that still have a concrete consumer.

## Leave No Scope-Creep Residue

When unsolicited scope or a rejected design is removed, return the work to the ordinary requested state. Name the result for what it is. The removed idea leaves no trace in names, comments, docs, tests, changelogs, commit messages, or pull-request text, unless its absence is a public contract or an invariant maintainers must preserve.

## Repository Invariants

- `packages/core` stays framework-agnostic; framework-specific behavior lives in its adapter package.
- Implementation sits near its domain. A new directory marks a real domain boundary.
- Package entrypoints export the intended public API only; internal symbols stay private.
- Extend the existing package and domain patterns; config, runtime, adapter, and CLI concerns stay separate where the package already separates them.
- A package's public API grows only when the requested behavior requires it.

## Implementation Conventions

- TypeScript with ESM and named exports; barrel exports only at package entrypoints. Biome owns formatting and import order.
- Core terminology comes from `CONTEXT.md`. Elsewhere, reuse the names the package already uses.
- Use explicit names for booleans, state transitions, structured types, and recursive traversals. Declare recursive traversal at module scope and pass context through parameters.
- Keep shared or semantically important defaults centralized.
- Use Makoo error types with stable `ErrorCode` values and structured `issues`, in the existing `[makoo]` tone.
- Validate input at the boundary and return normalized values without mutating caller input.
- Keep simple control flow continuous. Extract a function when it names a domain concept, is reused, isolates a testable algorithm, or removes real duplication or nesting.
- Write a comment only for intent, an invariant, or subtle behavior the code cannot show.

## Testing

Tests guard public behavior and package contracts:

- Drive scenarios through public controls: Command, Status, adapter callbacks, and real DOM changes.
- Assert exact outcomes: status values, `ErrorCode` via `toThrow(expect.objectContaining({ code }))`, issue paths, and call counts or order.
- Reach every branch with a scenario the real environment can produce. If the only way in is forcing a DOM primitive into an impossible state, such as `isConnected` changing between two consecutive reads, the branch is unreachable: delete it.
- Keep changes narrow: update tests for changed observable behavior without expanding unrelated coverage.

`skills/makoo-test-review/SKILL.md` holds the review process, the smell list, and the mutation-testing workflow.

## Scope

- Leave unrelated packages, generated output, scaffold templates, docs, dependencies, and release metadata untouched.
- Change dependencies with `pnpm` commands rather than by editing manifests or lockfiles.
- Run formatting or autofixes only on files that need them.

## Documentation And Release

- Read [references/documentation.md](references/documentation.md) before editing public README or documentation-site content. User-facing guidance describes current behavior; internal rationale stays out of it.
- Changesets and release work happen only on an explicit user request. Implementation, bug fixes, breaking changes, or commit requests do not grant that permission. For that work, read [references/release.md](references/release.md).
