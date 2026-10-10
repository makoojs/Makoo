---
name: makoo-test-review
description: Review whether Makoo monorepo tests actually protect behavior, without asking the user to read test code. Use after writing or changing tests in this repository, when presenting AI-generated tests for review, or when the user asks whether tests are meaningful, redundant, stale, hardcoded, or what mutation testing found.
---

# Makoo Test Review

The user does not review test code line by line. Produce a short review packet that lets them judge the tests from three signals: test titles, surviving mutants, and a smell scan. Then answer the two questions mutation testing cannot.

Run this after the change's normal `pnpm test <path>` passes.

## 1. Test titles

List only the titles of the changed test files:

```bash
pnpm exec vitest list <changed test files>
```

Show them grouped by file and compare against the behavior the change was meant to deliver. Point out:

- intended behavior with no matching title;
- two titles that state the same behavior (redundancy);
- titles using vocabulary that no longer exists — check `CONTEXT.md` for current terms;
- titles whose assertions check something weaker or different from what the title claims.

## 2. Surviving mutants

Mutation testing is configured for `packages/core` only. `vitest.mutation.config.ts` includes only core tests because Stryker requires its initial run to pass, and other packages still have known failures. When a package's suite passes, extend both that config's `include` and `mutate` in `stryker.config.json` before using this step there.

Mutate only the changed source files:

```bash
pnpm test:mutation --mutate packages/core/src/listener/execution.ts
```

Incremental mode reuses earlier results. Stryker writes its output under `.tmp/mutation/`: `report.json` (read mutants with `status: "Survived"`), `index.html` for browsing, `incremental.json`, and `sandbox/` for its temporary copy. Put extra analysis for that run in the same folder. A full core run takes several minutes, so prefer `--mutate` on changed files.

Stryker counts `Timeout` as killed, but a loaded machine produces false timeouts. Do not run other test jobs alongside Stryker. Before trusting a score that rests on timeouts, apply one timed-out mutation by hand and run the suite: if it passes quickly, the mutant actually survived.

For each survivor, report the line, the mutation, and a decision:

- **Behavior should change** → add or tighten a test through public behavior so it fails on this mutation.
- **No observable difference** → equivalent mutant or dead code; report it and leave it, or flag the code for removal.
- **Survives on each of two guards that check the same fact** → the guards mask each other. Keep the one right after the point where outside code runs, and test that one (see `skills/makoo-framework-development/references/core-runtime.md`).

Do not add tests whose only purpose is killing a mutant through implementation details, and do not chase 100%.

## 3. Smell scan

Search the changed test files for these and fix what applies:

| Smell | Fix |
|---|---|
| `toThrow()` with no argument | `toThrow(expect.objectContaining({ code: MakooErrorCode.X }))` |
| `toBeDefined`, `toBeTruthy`, `not.toBe(` as the final state check | assert the exact expected value |
| hardcoded dependency versions or large literal file contents | assert the contract (presence, source of truth such as `recommendedMakooVersions`) |
| assertions on a mock's internal call structure | assert the observable result, or rely on a real-render test |
| `try { … } catch { expect … }` without a guaranteed throw | `expect(() => …).toThrow(…)` |
| a test duplicated by a broader test elsewhere | delete the narrower one |
| a DOM primitive mocked into a state the real DOM cannot reach (e.g. `isConnected` changing between consecutive reads) | delete the test and the unreachable branch it covers |

## 4. Two questions mutation testing cannot answer

Answer both in the packet:

1. **Would a behavior-preserving refactor break this test?** Change-detector tests (pinned versions, mock internals, exact strings) kill mutants and look strong in the mutation report, yet only freeze the implementation.
2. **Does at least one test run the real thing end to end?** Fragment checks can stay green while the feature is broken. Example: scaffold template tests matched `createVueAdapter()` while the generated `main.ts` used a removed core API.

## Review packet

Present to the user, in their language:

```markdown
## Test review: <change>

**Verdict:** <one sentence: trustworthy / gaps found / blocked>

### Titles
<grouped titles, with missing, duplicate, stale, or mismatched ones marked>

### Surviving mutants
<file:line — mutation — decision (test added / equivalent / dead code)>
<mutation score for the mutated files>

### Smells fixed
<what was changed and why>

### Refactor coupling and end-to-end coverage
<answers to the two questions>

### Needs your decision
<only items where expected behavior is unclear>
```

Escalate to "Needs your decision" when a survivor or a stricter assertion reveals behavior that differs from the test title or spec. Do not pick the expected behavior silently; check `.scratch/` specs and the implementation first, then ask if still ambiguous.
