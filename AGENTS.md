# Makoo

A userscript development framework for Tampermonkey, Violentmonkey, and ScriptCat, organized as a pnpm workspace monorepo.

## Layout

- `packages/core`: framework-agnostic runtime core. Framework-specific logic belongs in the matching adapter package.
- `packages/vue`, `packages/react`: framework adapters.
- `packages/cli`: config resolution, project commands, and the Vite plugin.
- `packages/create-makoo`: scaffold templates.
- `apps/docs-website/docs/`: public documentation site source (VitePress).
- Root `docs/`: internal architecture docs, not published.
- `skills/`: Makoo-specific agent skills.

## Commands

- `pnpm test`: required for code changes; start with `pnpm test <path>` for the smallest relevant scope.
- `pnpm build`: run when changing public APIs, exports, build output, or package dependencies.
- `pnpm lint`, `pnpm lint:fix`: Biome check and autofix.
- `pnpm docs:build`: run for documentation changes.
- Do not run package-level `tsc -p` directly; it writes `.d.ts` files into source directories.

## Conventions

- Read `CONTEXT.md` before changing `packages/core`, and use its terminology.
- Read `skills/makoo-framework-development/SKILL.md` before changing the framework itself.
- Do not create, edit, or delete changesets unless explicitly asked.
