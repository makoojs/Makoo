# Troubleshooting

When the script doesn't work as expected, check in the order "development server → script installation → URL matching → entry execution → injection status → page behavior" to find which step the problem is in first.

## Reading Errors

Most runtime problems can be traced through the injection's status handle. Temporarily add the following to the entry:

```ts
const status = core.injection('panel').statusHandle;
status.subscribe(() => console.log('panel:', status.getSnapshot(), status.lastError));
```

Or add `makooDev()` and view each injection's status and errors directly on the injections page of the development terminal; see [Local Development](./development.md#view-injection-status-in-the-terminal).

The browser console also prints the error object for every execution failure and cleanup failure. Expand it and follow `cause` down to find the original line of code. For what each error code means, see the [Errors API](../api/errors.md#makooerrorcode).

## dev Fails to Start

Look at the first error in the terminal. Confirm that dependencies are installed, the entry file exists, and you are running the command in the project directory. The error code for invalid configuration fields is `MAKOO_CLI_CONFIG_INVALID`, and the message has one `field path: reason` per line; fix them as indicated. When the port is in use, switch to another port or close the process using it.

## The Install Page Opened, but Nothing Shows on the Page

The install page is only for installing the script. Confirm that the script manager has finished installing and the script is enabled, then open a target page matched by `@match`.

After changing `@match`, check whether the metadata in the script manager has been updated.

## The Script Doesn't Run

- Open the script manager's popup menu and confirm the script is running on the current page.
- Check the browser console for module loading failures or errors thrown by the entry.
- Confirm that `pnpm dev` is still running; the development script loads code from it.
- With `makooDev()` added, `Waiting for a browser runtime` on the terminal home page means there is currently no connection: it appears when the page isn't open, the script isn't installed or doesn't match, or the entry throws before `createMakoo()`.

## `apply()` Throws an Error

This is a configuration error, and none of the declarations in the batch started. Handle it by error code:

| Error code | Fix |
| --- | --- |
| `MAKOO_DECLARATION_INVALID` | Check that `apply()` got a non-empty batch of `inject()` / `listen()` declarations, and that attached listeners do not set `reinject` |
| `MAKOO_INJECTION_NAME_CONFLICT` | Use a different name, or first `await` the `remove()` of the existing same-named injection; the name is released only after cleanup finishes. An injection whose cleanup failed keeps occupying its name, and you need to reload the page |
| `MAKOO_ADAPTER_NOT_FOUND` | Call `core.useAdapter()` before `apply()`, and check the `adapter` name |

## The Component Doesn't Appear

Check the component status first:

| Status | Meaning and fix |
| --- | --- |
| `waiting` | The mount target hasn't been found yet. Run `document.querySelector('your injectAt')` in the console to check the selector |
| `failed` + `MAKOO_TARGET_WAIT_TIMEOUT` | The wait timed out (15 seconds by default). Check the selector, or increase `timeout` |
| `failed` + `MAKOO_MOUNT_FAILED` | The component threw while mounting. Expand `cause` to see the error in the component code |
| `failed` + `MAKOO_INJECTION_CLEANUP_FAILED` | Cleanup also failed after the mount failure, and the injection has been closed. When a Vue component throws partway through mounting (for example in a child component's `setup`), `errors` contains `MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED`. Fix the component and reload the page |
| `failed` + `MAKOO_ATTACHED_LISTENER_FAILED` | An attached listener failed and ended the component. Expand `cause` to see which listener |
| `mounted` | The component is mounted. Check whether host CSS covers or hides it, or whether it was mounted into an unexpected element |

Search the developer tools for the `div` added at the end of the mount target to confirm where the component container is.

## The Component Appeared, Then Disappeared

The site removed the mount target or the component container, and `lastError` is usually `MAKOO_MOUNT_TARGET_DETACHED`. Enable `reinject` so the component remounts on the new element; see [Handle Node Replacement](./reinject.md).

## The Listener Doesn't Fire

- Status is `waiting`: the listener target hasn't appeared yet; check `listenAt`.
- Status is `failed`: `MAKOO_TARGET_WAIT_TIMEOUT` means the wait timed out; `MAKOO_LISTENER_TARGET_DETACHED` means the site removed the target and `reinject` isn't enabled.
- Status is `bound` but the callback didn't run: confirm the event actually happens on this element or its descendants; when the site stops propagation, try `capture: true`.
- The callback ran but errored: the console shows `MAKOO_LISTENER_CALLBACK_FAILED`, and the listener stays bound.
- Attached listeners only start finding their targets after the component mounts; while the component is `waiting`, they don't bind.

## `useMakooComponent()` or React Hooks Throw

| Error code | Cause |
| --- | --- |
| `MAKOO_VUE_HOOK_OUTSIDE_COMPONENT` / `MAKOO_REACT_HOOK_OUTSIDE_COMPONENT` | The component wasn't mounted by Makoo, for example when used in a plain `createApp()`; in Vue, calling it in an event handler or `setTimeout` also throws this error. Call it at the top level of `setup` |
| `MAKOO_VUE_HOOK_OUTSIDE_SCOPE` | Called where there is no effect scope, for example `app.runWithContext()` in a plugin |
| `MAKOO_LISTENER_NOT_FOUND` | The name passed to `attachedListener(name)` isn't in the component's `listeners` |
| `MAKOO_INJECTION_NOT_FOUND` | `listener(name)` can't find this standalone listener; it may not have been `apply()`d yet, or it is a component |

## `start()` Throws `MAKOO_INJECTION_CLOSED`

This injection's cleanup failed earlier, so it has been closed and its name is still occupied. Check its `lastError` (a `MakooAggregateError`), fix the unmount or cleanup problem according to `errors`, then reload the page. For the reasoning, see [Why Cleanup Failure Closes the Injection](./lifecycle.md#why-cleanup-failure-closes-the-injection).

## The Component Mounted Twice or the Callback Fired Twice

- Enable only the one script you are currently testing in the script manager; for example, when both the development script and the build output are installed, disable one of them.
- Confirm that `createMakoo()` and `apply()` run only once in the entry, and aren't written inside a component or a callback that runs repeatedly.
- If you wrote `import.meta.hot.accept()` yourself, destroy the old instance in `dispose`; see [Hot Updates](./hmr.md#custom-hot-update-boundaries).

## GM APIs Are Unavailable

Import `@makoojs/cli/monkey` from browser code; don't call it in `vite.config.ts`. Confirm that the script manager ran the script on the current page, and that the build output's metadata declares the required permissions. The development script always declares `@grant *`, so "works in development, fails after building" usually means the output is missing the corresponding `@grant`. See [Userscript API](../api/monkey.md).

## preview Shows Old Content

preview doesn't compile source code. Run `build` again before `preview`, and confirm that both use the same `outDir` and that the script manager is running the newly built script. See [Build and Preview](./build.md).
