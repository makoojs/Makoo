---
"@makoojs/create-makoo": minor
"@makoojs/react": minor
"@makoojs/core": minor
"@makoojs/vue": minor
"@makoojs/cli": patch
---

### Minor Changes

🚀 This release replaces the old task runtime with explicit injections. Create a Core Instance with `createMakoo()`, register adapters with `useAdapter()`, then start work with `apply([inject() / listen()])`. Control and status are `command(name)` and `statusHandle(name)`. The previous `start()` entry, `id` / `artifact` / `options.alive` declarations, and the old error classes are gone. Existing projects need to change their entry. Bumping versions is not enough.

**✨ Highlights**

- 🧩 Declare components with `inject({ name, injectAt, adapter, component })` and host listeners with `listen()`. Attached listeners live on `listeners` and inherit the component's `reinject`.
- 🔁 Recover a replaced mount or listener target with `reinject`. Wait for a late target with `timeout`.
- 🎛 Read and control an injection from outside with `command(name)` and `statusHandle(name)`. Inside Vue use `useMakooComponent()`. Inside React use `useComponentCommand`, `useComponentStatus`, and the related hooks.
- 👀 Watch instance-level notices with `observe()`: injection removed, instance disposed, and diagnostics. There is no ObserverHub and no user hook on the declaration.
- 🧯 Errors are `MakooError` and `MakooAggregateError` (`message`, `code`, `cause`, and `errors` on aggregates). Codes use the `MAKOO_` prefix.
- 🖥 `makooDev()` shows one line per injection, indented attached listeners, and `lastError`. The default dev script name is `server:` plus `app.name`.
- 🔥 HMR stays with Vite. Scaffolds do not dispose the Core Instance on hot update.
- 📚 Docs and `create-makoo` templates use the new entry.

---

**🧩 @makoojs/core** `0.4.0` → `0.5.0`

- Replace `createMakoo({ adapters }).start([...])` with `createMakoo()`, `useAdapter()`, and `apply([inject() / listen()])`.
- Replace `id` / `artifact` / `options.alive` with `name`, `adapter`, `component`, and top-level `timeout` / `reinject` / `listeners`.
- Add `command(name)` and `statusHandle(name)` for control and status.
- Add `observe()` for `injection-removed`, `instance-disposed`, and `diagnostic`.
- Replace the old error classes with `MakooError` and `MakooAggregateError`.
- Attached listeners recover locally when only their target is replaced and the component has `reinject: true`. The component itself stays mounted.
- `dispose()` closes the instance and refuses new work. Cleanup failures are aggregated and not swallowed.

---

**🖥 @makoojs/cli** `0.5.0` → `0.5.1`

- Reconnect the dev bridge to injection snapshots and `observe()` notices. The terminal shows real phase names, indented attached listeners, and `lastError`.
- Keep `makoo dev` / `makoo build` / `makoo preview`. `makooDev()` only reports status. It does not start, stop, or remove injections.
- Leave HMR to Vite. The CLI does not dispose the old Core Instance on hot update.
- Change the default `monkey.server.prefix` from the string `'server:'` to `(name) => \`server:${name}\``. A string used to replace the whole script name, so every dev script showed up as `server:`.

---

**💚 @makoojs/vue** `0.1.4` → `0.2.0`

- Mount with `createVueAdapter()` and `adapter: 'vue'`.
- Add `useMakooComponent()` for status, `start` / `stop` / `remove`, attached listeners, and same-instance standalone listeners.
- Register shared plugins with `VuePlugin.use(...)` before `apply()`. Plugins added after a mount do not install on apps that are already mounted.

---

**⚛️ @makoojs/react** `0.1.4` → `0.2.0`

- Mount with `createReactAdapter()` and `adapter: 'react'`. Requires React 19 or later.
- Add `useComponentCommand`, `useComponentStatus`, `useAttachedListenerStatus`, `useGlobalListener`, and `useComponentStatusHandle`.
- Each mount creates its own React root. Rendering errors stay with React. Use an error boundary.

---

**📦 @makoojs/create-makoo** `0.2.0` → `0.3.0`

- Vue and React templates (JS and TS) use `createMakoo()` → `useAdapter()` → `apply([inject(...)])`.
- Templates do not write `import.meta.hot.dispose` or the old `tasks.destroyAll()`.
- Generated projects keep `makoo dev` / `makoo build` / `makoo preview`. `makooDev()` is still opt-in.

---

**📚 Docs**

- Rewrite the docs site in the Diátaxis layout, Chinese first, then English.
- Rewrite the root README and the core, Vue, React, CLI, and create-makoo READMEs for the new API.
- Refresh the homepage hero. The Chinese and English lines are intentionally different.

---

**🧭 If you are coming from the task runtime**

1. **Move the entry.** Use `createMakoo()`, `useAdapter(...)`, and `apply([inject(...) / listen(...)])`. Do not call `start()`.
2. **Rewrite declarations.** Use `name`, `adapter`, `component`, and top-level `timeout` / `reinject` / `listeners`. Use `reinject` instead of `alive`.
3. **Replace task commands** with `command(name)` / `statusHandle(name)`, or the Vue and React helpers inside a mounted component.
4. **Register Vue plugins** with `VuePlugin.use(...)` before `apply()`.
5. **Drop routine HMR cleanup.** Only call `dispose()` yourself if you opted into a custom `import.meta.hot.accept()` boundary.
6. **Expect dev scripts to be named** `server:<app.name>` unless you set `monkey.server.prefix` yourself.

New project:

```bash
pnpm dlx @makoojs/create-makoo
```

Docs: https://makoojs.github.io/Makoo/
