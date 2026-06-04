## [1.0.0] - 2026-03-21

### 🚀 Key Features

- **Lifecycle Management**: Automated mounting and unmounting of Vue instances, ensuring zero memory leaks in third-party environments.
- **Smart DOM Detection**: Built-in waiting mechanism to ensure target elements are fully ready before injection, solving race conditions on dynamic pages.
- **Robust Re-injection (Alive Mode)**: Automatically detects when the host page's DOM is rebuilt (e.g., SPA navigation or partial refreshes) and restores your components instantly.
- **Event Listener Integration**: Seamlessly bind reactive listeners to target elements with optional `signal` control for granular event management.
- **Idempotent Execution**: Enhanced `.run()` method that can be called multiple times safely; it only activates pending tasks without side effects.

### 📦 Ecosystem & Deliverables

- **NPM Distribution**: Fully available on Registry for `npm`, `pnpm`, or `yarn`.
- **Live Demo**: Explore the framework's stability and real-world injection scenarios at [flowingink.github.io/makoo/](https://flowingink.github.io/makoo/).
- **Full API Documentation**: Comprehensive documentation provided in both English and Chinese, covering everything from quick start to advanced patterns.

## [1.0.1] - 2026-03-21

- Relax the versions of vue and pinia

## [1.1.0] - 2026-04-02

- **refactor/modularize:** Injector core and decompose into specialized task modules by @FlowingInk in https://github.com/FlowingInk/makoo/pull/15
- **feat(injector):** support shared Vue plugins and unified plugin management by @FlowingInk in https://github.com/FlowingInk/makoo/pull/16
- **Feat/inject enhancement:** add some config to enhancement the dev and support custom Logger DI by ILogger interface @FlowingInk in https://github.com/FlowingInk/makoo/pull/17
- **refactor/Split global types:** Split global types into file of different module @FlowingInk in https://github.com/FlowingInk/makoo/pull/18
- **fix/lifecycle-routing-leak:** Fix the vulnerability where Injector bypasses TaskLifeCycle and directly calls the internal lifecycle, ensuring state is controlled.  @FlowingInk in https://github.com/FlowingInk/makoo/pull/19
- **chore/docs:** Refine README and add best practices by @FlowingInk in https://github.com/FlowingInk/makoo/pull/20


## [1.2.0] - 2026-04-09

### ✨ Features

- **feat(core):** integrate `ObserverHub` and observability hooks across task lifecycle, and expose observer-related APIs by @FlowingInk in https://github.com/FlowingInk/makoo/pull/21
- **feat(logger):** add log level control and expose `Injector.getLogger()` by @FlowingInk in https://github.com/FlowingInk/makoo/pull/22

### 🛠 Fixes

- **fix(logger):** switch to threshold-based level filtering (`debug < info < warn < error`) instead of exact-level matching
- **fix(injector):** ensure default `ObserverHub` reuses the injector logger instance for consistent logger DI behavior

### 📚 Tests & Docs

- add `ObserverHub` unit tests and extend task/injector/watcher tests around observability events
- update README and README.CN with observability hooks and logger usage examples

## [1.2.1] - 2026-04-09

- Fix the return issue in TaskRegister

## [1.3.0] - 2026-04-18

### ✨ Features

- **feat(hooks):** add lifecycle hooks support at injector-level (`new Injector({ hooks })`) and component-level (`register(..., { hooks })`), with unified subscribe/unsubscribe APIs (`on`, `onTask`, `onAny`, `off`, `offTask`, `offAny`) by @FlowingInk in https://github.com/FlowingInk/makoo/pull/25
- **feat(observe):** expose normalized lifecycle event model and payload matrix for register/run/inject/listener/alive/task/resource/dom events by @FlowingInk in https://github.com/FlowingInk/makoo/pull/25

### 🛠 Fixes

- **fix(alive):** remove `nextTick` async setup window for alive observers and simplify to synchronous setup; remove `aliveEpoch` from runtime and event payloads by @FlowingInk in https://github.com/FlowingInk/makoo/pull/26
- **fix(task):** split task runtime into `ComponentTask` / `ListenerTask` and tighten lifecycle routing and cleanup consistency across `TaskContext`, `TaskRunner`, and `TaskLifeCycle` by @FlowingInk in https://github.com/FlowingInk/makoo/pull/25
- **fix(observe):** normalize and stabilize observe payload builders (`register`, `run`, `inject`, `listener`, `alive`, `task`, `resource`, `dom`) and emit DOM watcher events with named event contracts by @FlowingInk in https://github.com/FlowingInk/makoo/pull/25

### 📚 Tests & Docs

- add/refresh unit tests for hooks, payload normalization, task context/lifecycle/runner behaviors, and alive semantics
- update `README.md` and `README.CN.md` with lifecycle hook usage, event groups, and detailed payload field tables

### 🧰 Tooling & CI

- add auth tester workflow for NPM/GitHub token validation by @FlowingInk in https://github.com/FlowingInk/makoo/pull/24
- migrate dependency management to `pnpm`, remove `package-lock.json`, and add `pnpm-lock.yaml`
- update CI/Pages/patch-release workflows to use `pnpm` install/cache/publish pipeline


## [1.3.1] - 2026-04-18

- fix the public demo website url in readme.md

## [Unreleased]

### ✨ Features

- **feat(adapter):** introduce a framework-agnostic mount adapter protocol and `Injector.applyAdapter()`, allowing each injector instance to resolve and mount non-Vue artifacts through custom adapters.
- **feat(vue):** move Vue mounting into the default compatibility adapter while keeping `Injector` Vue-compatible out of the box.
- **feat(react):** add optional React adapter support, React mount types, optional React peer dependencies, and a demo case showing React element injection.
- **feat(signal):** add `createActivityStore()` and the activity signal protocol for listener activation control, with `get()` / `subscribe()` based stores.
- **feat(observer):** add hook propagation control through the second hook argument, supporting `ctrl.stopPropagation()` and `ctrl.stopImmediatePropagation()` across task, event, and global hook scopes.

### ♻️ Refactors & Compatibility

- **refactor(core):** replace direct Vue `App` runtime storage with adapter `mountHandle`, `instance`, `hostElement`, and adapter-driven unmount cleanup.
- **refactor(api):** rename component-oriented internal/runtime fields toward artifact terminology, including lifecycle payload metadata moving from `meta.componentName` to `meta.artifactName`.
- **refactor(vue):** centralize Vue plugin handling in the singleton `VuePlugin` registry and expose it for advanced orchestration.
- **refactor(adapter):** move Vue adapter implementation from `core/adapter` to `adapters/vue`, add `BaseInjector`, and keep the public `Injector` as the Vue-compatible facade.
- **refactor(vue):** tighten Vue component recognition so plain function artifacts can be reserved for other adapters instead of being treated as Vue components.
- **compat(signal):** keep Vue `ref`-like activity signals working in `1.x`, but mark that path as deprecated in favor of `ActivitySignalStore`.

### 📚 Tests & Docs

- Add coverage for custom adapter registration, React adapter mount/unmount behavior, activity signal stores and ref compatibility, ObserverHub propagation control, and updated artifact task runtime state.
- Update English and Chinese README content for adapter usage, React support, activity signals, `VuePlugin`, hook propagation control, exported types, and artifact-oriented payload fields.
- Refresh the demo with a React injection scenario and updated adapter usage examples.
