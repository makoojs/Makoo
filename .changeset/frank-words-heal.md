---
"@makoojs/create-makoo": patch
"@makoojs/cli": patch
"@makoojs/react": patch
"@makoojs/vue": patch
---

Move `@makoojs/core` to a consumer-provided peer dependency for the CLI and framework adapters.

`@makoojs/cli`, `@makoojs/vue`, and `@makoojs/react` now expect Makoo projects to install `@makoojs/core` explicitly, while keeping it as a workspace dev dependency for local package development. This avoids installing a nested copy of core when downstream projects already declare their own core dependency.

The create-makoo templates now recommend the aligned Makoo package versions for generated projects.
