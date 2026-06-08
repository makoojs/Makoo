# Makoo Project Map

Use this file when the requested change spans packages, adds new files, or needs a sanity check on where code should live.

## Package Responsibilities

- `packages/core`
  - Own runtime primitives, injection lifecycle, adapters contracts, observer payloads, watcher behavior, task orchestration, logger, and shared error types.
  - Keep this package framework-agnostic.
- `packages/cli`
  - Own config parsing and normalization, source scanning, manifest loading, validation, renderers, and the Vite plugin surface.
  - Keep file generation split by concern rather than one monolithic renderer.
- `packages/react`
  - Own React-specific mount and unmount behavior plus React-facing errors and type guards.
- `packages/vue`
  - Own Vue-specific mount and unmount behavior, Vue plugin registration helpers, Vue-facing errors, and Vue type guards.
- `packages/create-makoo`
  - Own starter project templates and scaffold-time file content.

## Recurring File Patterns

- `index.ts`
  - Re-export public package API only.
- `types.ts` or `type.ts`
  - Keep closely related type definitions near the implementation domain.
- `defaults.ts`
  - Centralize default values, regexes, constants, and fixed identifiers that multiple functions rely on.
- `resolve.ts`
  - Convert partial or user-facing config into normalized resolved structures.
- `validation.ts`
  - Reject unsupported or invalid input near the boundary.
- `error.ts` or `XError.ts`
  - Encode domain-specific failures with stable messages and codes.

## Style Signals To Preserve

- Prefer explicit imports over wildcard patterns.
- Prefer short pure helpers such as `resolveFramework`, `resolveFileSystemPath`, or `normalizeInjectionManifest`.
- Prefer early returns for guard cases.
- Keep state machines and lifecycle transitions explicit instead of hiding them in compact expressions.
- Build structured payload objects close to the emit site when event semantics matter.

## Testing Patterns

- Resolver tests assert merged defaults, path normalization, and override precedence.
- Runtime tests create realistic DOM or adapter fixtures and verify lifecycle transitions.
- Adapter tests focus on mount and unmount success and wrapped failure behavior.
- CLI and generator tests verify emitted code fragments and config transformation results.

## Edit Checklist

Before finalizing a change, check:

1. Did the code land in the package that already owns that responsibility?
2. Did new names match existing domain vocabulary?
3. Did public exports remain intentional and minimal?
4. Did error handling stay typed and Makoo-specific?
5. Did tests cover the changed behavior at the right package level?
6. Would `biome` formatting keep the file aligned with repo style?
