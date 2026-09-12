# Hot Updates and Cleanup

In a standard project, `vite-plugin-monkey` connects the userscript to the Vite development client, and Vite plus the Vue / React plugin handle updates.

## What happens when you edit code

| Changed code | Default update behavior |
| --- | --- |
| Vue / React components | The framework plugin updates within a compatible component boundary; state preservation depends on the edit |
| Styles | Vite or Monkey's style handling updates the corresponding styles |
| Ordinary Task modules or the application entry | If no local HMR boundary accepts the update, it propagates to the entry and triggers a full page reload |

A full reload ends the old page context, releasing its components, DOM listeners and observers. The development script then starts again in the new page. When a framework accepts a local component update, the Makoo Runtime continues running.

## Custom HMR boundaries

If you add `import.meta.hot.accept()` or create a Runtime inside a component module recognized as an HMR boundary, updates may stop at that module. That module must then manage cleanup and recreation of its side effects; it cannot assume the page will reload.

Keep Runtime creation and task startup in an ordinary application entry, with components owning their UI. To remove a feature while the page continues running, use task handles or Runtime destruction methods; see [Lifecycle and Cleanup](./lifecycle.md). Components should still release their own timers, subscriptions and events in framework unmount hooks.

## Configuration and dependency changes

After installing or upgrading dependencies, or changing plugins and resolution settings, check whether Vite restarts automatically. Press `r` on the dev home when a manual restart is needed. After changing script metadata, also check that the manager has the updated development script.

Restarting the server and updating a browser entry are different operations: one recreates the dev server, and the other replaces modules on the page. See [Local Development](./development.md) for connections and shortcuts.
