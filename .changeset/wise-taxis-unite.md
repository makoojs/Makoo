---
"@makoojs/core": minor
---

## 🚨 Breaking Changes

`@makoojs/core` now uses a declaration-based runtime API centered on `createMakoo()`, `inject()`, `listen()`, and `makoo.start(...)`.

The old public `Injector` facade has been removed. If you previously created an injector instance and called `register()` / `registerListener()` / `run()`, migrate to declaring tasks first and starting them as a batch:

## ✨ New Runtime API

The new API separates declaration from execution:

- `createMakoo()` creates the runtime.
- `inject()` declares a component injection task.
- `listen()` declares a listener task.
- `makoo.start([...])` registers and starts a batch of declarations.
- `start()` returns `StartedTasks` for controlling the tasks created by that batch.

## 🧩 New Runtime Types

This release also exposes the new runtime-facing types, including:

- `MakooRuntime`
- `StartedTasks`
- `MakooTaskDeclaration`
- `MakooInjectionDeclaration`
- `MakooListenerDeclaration`
