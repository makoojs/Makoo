# React API

The APIs on this page are imported from `@makoojs/react`.

## `createReactAdapter()`

Creates a component adapter named `'react'`.

```ts
function createReactAdapter(): ReactMountAdapter;
```

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel';

const core = createMakoo();
core.useAdapter(createReactAdapter());
core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'react', component: Panel })
]);
```

On each mount, the adapter calls `createRoot()` on the component container and renders the component with `root.render()`; a return from `render()` counts as a successful mount, without waiting for the first commit or effects. On unmount, it calls `root.unmount()`.

So by the component's first render, the status is usually already `mounted`. Errors thrown during rendering (including hooks not finding a name) are handled by React itself and don't fail this mount; the injection stays `mounted`. If you need a fallback, use an Error Boundary inside the component.

The `props` in the declaration are passed as the component's props.

## Hooks

The following hooks can only be called in a React component tree mounted by Makoo, child components included; otherwise they throw `MAKOO_REACT_HOOK_OUTSIDE_COMPONENT`. All subscriptions are released automatically when the component unmounts.

In a component mounted by [`injectEach()`](./declarations.md#injecteach), the hooks refer to that Child Injection only: `useComponentCommand().stop()` unmounts this one component, and the other matches stay mounted. A Child has no attached listeners, so `useAttachedListenerStatus()` always throws `MAKOO_LISTENER_NOT_FOUND`.

| Hook | Returns | Subscribes |
| --- | --- | --- |
| [`useComponentCommand()`](#usecomponentcommand) | The owning component's command handle | No |
| [`useComponentStatus()`](#usecomponentstatus) | The component status | Yes |
| [`useAttachedListenerStatus()`](#useattachedlistenerstatus) | The status of an attached listener | Yes |
| [`useListener()`](#uselistener) | The command and status of a standalone listener | Yes |
| [`useComponentStatusHandle()`](#usecomponentstatushandle) | The owning component's raw status handle | No |

```tsx
import { useAttachedListenerStatus, useComponentCommand } from '@makoojs/react';

export default function Panel() {
  const { remove } = useComponentCommand();
  const search = useAttachedListenerStatus('search-submit');

  return (
    <aside>
      <p>Search box: {search}</p>
      <button onClick={() => remove()}>Close</button>
    </aside>
  );
}
```

### `useComponentCommand()`

```ts
function useComponentCommand(): ComponentCommand;
```

Returns the owning component's [command handle](./status.md#command-handle). The reference is stable within one mount and creates no status subscription, so it can go into effect dependencies.

### `useComponentStatus()`

```ts
function useComponentStatus(): ComponentStatus;
function useComponentStatus<T>(select: (status: ComponentStatus) => T): T;
```

Subscribes to the owning component's status. With a selector, returns the selected result, compared with `Object.is`; no re-render is triggered when it doesn't change. If the selector returns a new object every time, every status change re-renders; return primitive values such as booleans or strings.

```ts
const failed = useComponentStatus((status) => status === 'failed');
```

### `useAttachedListenerStatus()`

```ts
function useAttachedListenerStatus(name: string): ListenerStatus;
function useAttachedListenerStatus<T>(name: string, select: (status: ListenerStatus) => T): T;
```

Subscribes only to the attached listener named `name` in the owning component. The subscription switches when `name` changes. Throws `MAKOO_LISTENER_NOT_FOUND` if the name doesn't exist.

### `useListener()`

```ts
function useListener(name: string): ListenerCommand & {
  readonly status: ListenerStatus;
  readonly lastError: MakooError | undefined;
};
```

Finds a standalone listener in the same Core instance, returns flat command methods wrapping `core.listener(name)`, and subscribes to its status. Unmounting the component only releases the subscription and doesn't stop this listener.

When no standalone listener is found (the name doesn't exist, belongs to a component, or is only an attached listener), it throws `MAKOO_INJECTION_NOT_FOUND`.

The lookup is repeated on every render. After that standalone listener is removed and `apply()`d again, the new listener's command and status are picked up on the next render. When the callback fails, the status stays `bound` and only `lastError` is written, which doesn't trigger a re-render.

```tsx
function ShortcutToggle() {
  const shortcut = useListener('shortcut');

  return (
    <button onClick={() => (shortcut.status === 'idle' ? shortcut.start() : shortcut.stop())}>
      Shortcut: {shortcut.status}
    </button>
  );
}
```

### `useComponentStatusHandle()`

```ts
function useComponentStatusHandle(): ComponentStatusHandle;
```

Returns the owning component's raw [status handle](./status.md#status-handle), the same as `core.injection(name).statusHandle`. Getting it creates no subscription; it is commonly used to read `lastError`:

```tsx
const failed = useComponentStatus((status) => status === 'failed');
const { lastError } = useComponentStatusHandle();

return failed ? <p>{lastError?.message}</p> : null;
```

`lastError` is not part of the status snapshot, and reading it doesn't trigger updates. The example above re-renders on failure by subscribing to `failed`, and then reads `lastError`.

## `ReactErrorCode`

| Constant | Value |
| --- | --- |
| `REACT_HOOK_OUTSIDE_COMPONENT` | `'MAKOO_REACT_HOOK_OUTSIDE_COMPONENT'` |

## Types

```ts
type ReactMountComponent = ComponentType<any>;
type ReactMountProps = Record<string, unknown>;
type ReactMountRoot = Root;
type ReactMountAdapter = MountAdapter<ReactMountComponent, ReactMountProps, ReactMountRoot>;
```
