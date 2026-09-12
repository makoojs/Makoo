# Makoo Project Map

Use this file when the requested change spans packages, adds new files, or needs a sanity check on where code should live.

## Package Responsibilities

- `packages/core`
  - Own runtime primitives, injection lifecycle, adapter contracts, observer payloads, watcher behavior, task orchestration, logging, and shared error types.
  - Keep this package framework-agnostic.
  - Existing runtime domains include `Makoo/`, `runtime/`, `Task/`, `watcher/`, `payload/`, and `adapter/`.
- `packages/cli`
  - Own config parsing and normalization, validation, project commands, and the Vite plugin surface.
  - Keep `entry`, application metadata, and monkey options semantically separated in resolved config.
  - Resolve the configured application module relative to the project root before passing it to `vite-plugin-monkey`.
- `packages/react`
  - Own React-specific mount and unmount behavior plus React-facing errors and type guards.
- `packages/vue`
  - Own Vue-specific mount and unmount behavior, Vue plugin registration, Vue-facing errors, and Vue type guards.
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

## Package-Level Test Focus

- Resolver tests assert merged defaults, path normalization, and override precedence.
- Runtime tests create realistic DOM or adapter fixtures and verify lifecycle transitions.
- Adapter tests focus on mount and unmount success and wrapped failure behavior.
- CLI tests verify config transformation, command behavior, and Vite plugin options.
