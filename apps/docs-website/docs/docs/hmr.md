# Hot Updates

How does the script in the browser update after you change code during development? The short answer: Makoo does not handle hot updates; it leaves them entirely to Vite and the framework plugins. This page explains why that is enough, and the one case where you have to clean up yourself.

## What Happens by Default

| What changed | How it updates |
| --- | --- |
| A Vue single-file component | `@vitejs/plugin-vue` updates it in place inside the component, without re-running the entry |
| A React module that only exports components | React Fast Refresh updates it in place, without re-running the entry |
| A React module that exports non-component content | The update propagates up the dependency chain to the entry, and the whole page reloads |
| The entry `main.ts` or ordinary modules it imports | The whole page reloads |
| Styles | Updated by Vite or the framework plugin |

On a full page reload, the browser destroys the old page together with the old Core instance, components, and event bindings, and the development script runs again on the new page, so there is only one new instance. When a component updates in place, the entry does not run again and `createMakoo()` is not called again.

So in the default flow, "the component mounts twice after a hot update" does not happen, and the entry doesn't need `import.meta.hot.dispose()`. Even if you write it, the entry is not a hot update boundary, so the callback is never called.

## Why Entry Updates Reload the Whole Page

When Vite receives a file change, it walks up the import chain looking for a module that can accept the update. The entry has no importer and doesn't accept updates itself, so Vite tells the browser to reload the whole page.

In development mode, `vite-plugin-monkey` makes the script load the Vite client first and then your entry. So this reload reloads the host page itself: everything on the old page ends with it.

## Custom Hot Update Boundaries

There is only one case where you have to clean up yourself: you explicitly wrote `import.meta.hot.accept()` and created a Core instance in that module. The update then stops at this module, and when the module re-runs it creates a second instance while the old one is still running.

In that case, destroy the old instance in the same module:

```ts
import { createMakoo } from '@makoojs/core';

const core = createMakoo();
// ...useAdapter, apply

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => core.dispose());
}
```

Makoo does not generate this code for you. We recommend putting `createMakoo()` and `apply()` in an ordinary entry module and letting the default full page reload handle updates.

## Configuration and Dependency Changes

After installing or upgrading dependencies or editing `vite.config.ts`, watch whether Vite restarts automatically; when you need to restart manually, press `r` in the development terminal. After changing script metadata such as `@match`, also confirm that the development script in the script manager has been updated; see [Local Development](./development.md).
