# Troubleshooting

Check the path in order: server → installation → page match → Runtime → task → component. First identify which stage failed.

## Dev fails to start

Read the first terminal error. Check installed dependencies, the entry file, and the directory where you ran the command. Fix invalid configuration at the reported field path. Change ports or stop the process occupying the requested port.

`--strictPort` exits when the requested port is unavailable. See [CLI Commands](../api/cli.md).

## Installation opens, but no component appears

The installation page installs the script. Confirm that installation finished and that the manager enabled the script, then open a target page matching `@match`.

After changing `@match`, inspect the script metadata in the manager.

## The terminal has no task action

Check that `vite.config.ts` includes both `makoo(...)` and `makooDev()`, and start with `makoo dev`.

Redirected output and CI do not show interactive views. See [Local Development](./development.md).

## Waiting for a Runtime

Confirm that the target page is open and its script reached `createMakoo()`. Check the browser console for module loading or entry execution errors, and ensure the dev server is still running.

## A task exists, but its component is missing

1. Use `document.querySelector('your-selector')` in the target page’s console to check the target.
2. Confirm that the component matches the registered Vue or React adapter.
3. Inspect events such as `dom:targetTimeout` and `artifact:mountFail`, and browser errors.
4. If mounted, check host CSS, overlapping elements, positioning, and visibility.

`pending` means waiting for a target; `idle` means not currently running. Neither provides a full diagnosis. Subscribe to specific events through the [Events and State API](../api/observation.md).

## A panel disappears after target replacement

Check whether the host removed the matched target. Enable `alive` with an appropriate `scope` if you need reinjection when the same selector returns. A URL change still requires your application to decide how tasks should change. See [Lifecycle and Cleanup](./lifecycle.md).

## Duplicate mounts or callbacks after hot updates

- Enable only the script you are testing in the script manager.
- Check whether component renders or repeated callbacks call `createMakoo()` multiple times.
- If you defined a custom HMR boundary, check its cleanup of old side effects. Components should also release their events and timers on unmount.

See [Hot Updates](./hmr.md) for update behavior and boundaries.

## GM APIs are unavailable

Import `@makoojs/cli/monkey` in browser application code, not Node configuration. Check that the script manager runs the script on this page and that the actual metadata declares the required permissions. See [Userscript APIs](../api/monkey.md).

## Preview shows old content

Build again before previewing. Use the same `outDir` for both commands and confirm that the manager runs the newly built script. Preview does not compile source automatically. See [Build and Preview](./build.md).
