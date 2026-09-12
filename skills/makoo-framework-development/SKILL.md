---
name: makoo-framework-development
description: Use when developing the Makoo framework/monorepo itself, especially when changing packages/core, packages/cli, packages/react, packages/vue, packages/create-makoo, repository config, tests, package APIs, adapters, or internal documentation. Do not use for ordinary downstream projects that only consume Makoo.
---

# Makoo Framework Development

Use this skill for Makoo's framework monorepo, packages, adapters, CLI, scaffolding, tests, docs, and shared configuration. Preserve its library-first architecture and existing domain boundaries. For an ordinary userscript project that consumes Makoo, use the Makoo injection workflow skill instead.

Makoo is currently a pre-1.0, same-repository, lockstep-maintained project. Judge architecture, compatibility, and recovery costs at that scale rather than assuming the needs of a mature cross-team platform.

## Start With The Owning Boundary

Identify the target package, then read its nearest implementation, sibling files, tests, and public exports before editing. Keep responsibility in the package that already owns it.

Read [references/project-map.md](references/project-map.md) when a change spans packages, adds files, changes public exports, or leaves ownership unclear.

## Current-Need Gate

Design from Makoo's current requirements, consumers, and observed failure modes. Do not infer infrastructure merely from an architectural label.

Before adding any field, file, service, protocol, discovery mechanism, compatibility layer, fallback, or abstraction, answer:

- What current behavior, constraint, or observed failure requires it?
- Which current consumer reads, calls, or enforces it?
- Why is explicit failure insufficient for this case?

If there is no current requirement and no current consumer, leave it out. A plausible future workflow is not a requirement. Terms such as "runtime session" do not by themselves justify service discovery, protocol versioning, authentication, reconnection, multi-instance coordination, or cross-version compatibility.

Prefer the simplest clear implementation that satisfies the present contract. Generalize only after real repetition appears and the boundary has stabilized. Do not introduce layers, generic frameworks, configuration, or extension points to make a design look complete.

## Failure And Fallback Policy

Explicit failure is a valid design when automatic recovery is not part of the current contract. Validate required data close to its source and fail with a specific error; do not force values to "always exist" through defaults, `??`, optional chaining, recovery branches, or compatibility code that masks an abnormal state.

Add fallback or recovery only when at least one of these currently requires it:

- a runtime constraint;
- public API semantics;
- an existing package-local behavior with the same purpose;
- an explicit user requirement or observed workflow.

Inspect the current package for an established handling pattern before adding a new one. Preserve explicit failure when no concrete requirement justifies recovery.

When a design is challenged, reassess each part independently against current evidence. Remove unsupported completeness, but retain mechanisms that still have a concrete consumer and justification. Do not swing between keeping everything and deleting everything merely to agree.

## Leave No Scope-Creep Residue

When unsolicited scope, an unnecessary mechanism, or a rejected design is removed, return the work to the ordinary requested state. The removed mistake must not become a new concept that survives in names, comments, docs, tests, changelogs, commit messages, or pull-request titles and descriptions.

- Name the result for what it is, not for what it excludes. Do not create "without X," "legacy-free," or similar variants for something that was never part of the accepted requirement.
- Do not add comments, documentation, or tests explaining the absence of rejected work unless that absence is an actual public contract or a non-obvious invariant future maintainers must preserve.
- Describe the delivered behavior and relevant constraints directly. Do not turn cleanup of unsolicited work into feature history or release narrative.

## Repository Invariants

- Keep `packages/core` framework-agnostic. Framework-specific behavior belongs in its adapter package.
- Place implementation near its domain and add a directory only for a real domain boundary, not one-off indirection.
- Keep package entrypoints minimal. Export public API intentionally from package entrypoints; keep internal symbols private.
- Extend the repository's existing package and domain patterns instead of introducing generic application layers such as controller/service/repository or SPA-specific architecture.
- Preserve config, runtime, adapter, and CLI concerns as separate responsibilities when the package already separates them.
- Do not broaden a package's public API unless the requested behavior requires it.

## Implementation Conventions

- Write TypeScript with ESM imports and exports. Prefer named exports and use barrel exports only at package entrypoints.
- Let Biome define formatting and import order. Match nearby code for file layout and naming.
- Reuse Makoo's existing domain vocabulary, such as `inject`, `listen`, `register`, `resolve`, `normalize`, `observe`, `watch`, `adapter`, `task`, and `config`.
- Use explicit names for booleans, state transitions, structured types, and recursive traversals. Avoid context-free names such as `process`, `handle`, or `walk` when the domain can be named.
- Keep shared or semantically important defaults centralized. Infer values only where the package already does so; fail specifically when ambiguity is unsafe.
- Use Makoo-specific error types and preserve the `[makoo]` tone. Include stable error codes and structured issue details when extending an error pattern that already supports them.
- Validate input at the boundary and return normalized values instead of mutating caller input.
- Add comments only for intent, invariants, or subtle behavior.

Keep simple, continuous control flow intact. Do not extract one-use helpers that merely forward arguments or wrap a few expressions. Extract when a function names a real domain concept, is reused, isolates a testable algorithm, or materially removes duplication or nesting.

Declare recursive traversal at module scope with an explicit, domain-specific name. Pass context and accumulators through parameters rather than hiding data flow in an enclosing closure.

## Scope And Verification

- Keep narrow changes narrow. Do not casually modify unrelated packages, generated outputs, scaffold templates, docs, dependencies, or release metadata.
- Use the current `package.json` scripts through `pnpm`; change dependencies with `pnpm` rather than hand-editing manifests or lockfiles.
- Run the smallest relevant Vitest target first. Update tests for changed observable behavior and normalization results without expanding unrelated coverage.
- Test public behavior and package contracts rather than private implementation trivia unless the repository already follows that pattern.
- Expand to broader build, test, or lint checks only when the change's scope or risk justifies them.
- Do not routinely run package-level `tsc -p` commands: Makoo's package tsconfigs can emit `.d.ts` files into source directories. Use the package's actual build pipeline or targeted runtime checks instead.
- Run formatting or autofixes only when the edited files need them.

## Documentation Work

When editing public README or documentation-site content, read [references/documentation.md](references/documentation.md). Keep internal architecture rationale out of user-facing guidance unless users need it to use or debug the feature.

## Changesets And Release Work

Changesets are a separate, explicitly authorized release action. Never create, edit, or delete a changeset unless the user directly asks for changeset work. Do not infer permission from an implementation request, bug fix, breaking API change, documentation update, commit request, or the fact that a published package is affected.

Read [references/release.md](references/release.md) only when the user asks about versioning, changelogs, release automation, publishing, or a release failure.
