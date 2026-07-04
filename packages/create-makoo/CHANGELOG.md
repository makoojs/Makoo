# @makoojs/create-makoo

## 0.1.6

### Patch Changes

🔧 Refresh Scaffolded Makoo Versions

Updated the recommended Makoo package versions used by `@makoojs/create-makoo` templates so new projects start with the latest compatible `@makoojs/core` runtime behavior.

## 0.1.5

### Patch Changes

Add a PR-time check that ensures create-makoo's recommended Makoo package versions stay aligned with pending Changesets releases.

## 0.1.4

### Patch Changes

Move `@makoojs/core` to a consumer-provided peer dependency for the CLI and framework adapters.

`@makoojs/cli`, `@makoojs/vue`, and `@makoojs/react` now expect Makoo projects to install `@makoojs/core` explicitly, while keeping it as a workspace dev dependency for local package development. This avoids installing a nested copy of core when downstream projects already declare their own core dependency.

The create-makoo templates now recommend the aligned Makoo package versions for generated projects.

## 0.1.3

### Patch Changes

- 10646e4: Fix generated project path handling across platforms.
