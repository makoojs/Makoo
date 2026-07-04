---
"@makoojs/core": patch
"@makoojs/cli": patch
---

Patch Changes

✨ New Object-Form Injection API

`@makoojs/core` now supports object-form `inject()` declarations.

You can continue using the existing positional form: `inject('#toolbar', Toolbar, options)`.

Or use the new object form when you want to keep declaration fields together or provide a stable task id: `inject({ id: 'toolbar', injectAt: '#toolbar', artifact: Toolbar, options })`.

The optional `id` is used as the task id, making later task lookup and control easier through APIs such as `started.get(...)`, `reset(...)`, and `destroy(...)`.

🐛 Safer Inferred Injection Task IDs

Core now avoids false duplicate detection when different artifacts share the same artifact name and target selector.

Previously, two different components with the same name, such as multiple `App.vue` files injected into `body`, could resolve to the same inferred task id and cause the second task to be skipped as a duplicate.

Makoo now keeps duplicate skipping for the same artifact reference, while assigning fallback task ids when different artifacts would otherwise collide.

Patch Changes

🔧 CLI Uses Module IDs As Injection Task IDs

`@makoojs/cli` now generates object-form `inject()` declarations and passes each resolved module id as the task id.

This makes generated runtime tasks stable and prevents same-named components from colliding at runtime, for example `inject({ id: 'profile-panel', injectAt: 'body', artifact: Injection_profile_panel, options })`.

📚 Documentation

Updated the core README and docs website API pages to show both `inject()` forms and explain when the object form is useful.
