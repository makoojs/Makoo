# Declarations

The APIs on this page are imported from `@makoojs/core`. `inject()` and `listen()` only create declaration objects; they don't access the DOM, register, or start anything. Declarations are validated and run only after they are passed to [`core.apply()`](./instance.md#apply).

## `inject()`

Declares a component: mounts a framework component into an element of the host page.

```ts
function inject<TComponent = unknown, TProps = unknown>(
  input: MakooComponentInput<TComponent, TProps>
): MakooComponentDeclaration<TComponent, TProps>;
```

```ts
import { inject, listen } from '@makoojs/core';
import Toolbar from './Toolbar.vue';

const toolbar = inject({
  name: 'toolbar',
  injectAt: '#header',
  adapter: 'vue',
  component: Toolbar,
  props: { compact: true },
  timeout: 30000,
  reinject: true,
  listeners: [
    listen({ name: 'search-submit', listenAt: '#search', type: 'submit', callback: onSubmit })
  ]
});
```

### `MakooComponentInput`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | Required | Injection name, unique among the top-level injections of the same Core instance |
| `injectAt` | `string` | Required | CSS selector of the mount target |
| `adapter` | `string` | Required | Name of a registered adapter, such as `'vue'` or `'react'` |
| `component` | `TComponent` | Required | The framework component to mount |
| `props` | `TProps` | `undefined` | Props passed as-is to the root component |
| `timeout` | `number` | `15000` | Wait budget for each search for the mount target, in milliseconds |
| `reinject` | `boolean` | `false` | Whether to search and mount again after the mount target or component container becomes invalid; also determines whether attached listeners can recover locally |
| `listeners` | Array of `listen()` declarations | `[]` | Attached listeners, started and stopped together with the component |

### Field Constraints

- `name`, `injectAt`, and `adapter` can't be empty or whitespace only; `injectAt` must be a valid CSS selector. The same applies to a listener's `name`, `listenAt`, and `type`.
- `timeout` must be greater than 0 and no more than `2147483647`.
- Attached listener names are unique within the owning component and may match top-level injection names.
- Attached listeners can't set `reinject`; they use the component's `reinject`.

When a constraint is violated, `apply()` throws `MAKOO_DECLARATION_INVALID`; duplicate attached listener names throw `MAKOO_INJECTION_NAME_CONFLICT`.

### Mount Position

Core uses the first element matching `injectAt` as the mount target, appends a `div` at its end as the component container, and mounts the component in that container. When the component stops, Core unmounts the component and removes the container, without touching the mount target's original content.

Makoo doesn't copy or freeze `props`. Vue shallow-copies root props, so for the component to see outside changes, pass a `reactive()` or `ref()` as a property of `props`, for example `props: { state }`.

## `listen()`

Declares a host listener: binds a native event on an element of the host page.

```ts
function listen(input: MakooListenerInput): MakooListenerDeclaration;
```

```ts
import { listen } from '@makoojs/core';

const escape = listen({
  name: 'escape',
  listenAt: 'body',
  type: 'keydown',
  capture: true,
  callback(event) {
    if (event instanceof KeyboardEvent && event.key === 'Escape') console.log('Escape');
  }
});
```

Putting the return value directly into `apply()` makes it a standalone listener; putting it into `inject()`'s `listeners` makes it an attached listener.

### `MakooListenerInput`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | Required | Injection name; attached listeners only need to be unique within the owning component |
| `listenAt` | `string` | Required | CSS selector of the listener target |
| `type` | `string` | Required | Event type, such as `'click'` |
| `callback` | `(this: Element, event: Event) => unknown` | Required | Event handler |
| `capture` | `boolean` | `false` | Whether to fire in the capture phase |
| `timeout` | `number` | `15000` | Wait budget for each search for the listener target, in milliseconds |
| `reinject` | `boolean` | `false` | Whether to search and bind again after the listener target becomes invalid; only standalone listeners can set it |

### Event Handler

- The listener is bound to the first element matching `listenAt`. `this` is that element, and `event` is the native event object.
- When the callback throws synchronously or returns a rejected Promise, Core prints a `MAKOO_LISTENER_CALLBACK_FAILED` error and the listener stays bound. Standalone listeners also write this error to `lastError`.
- The listener target can only be read through `this` when the callback is a regular `function`; with arrow functions, use `event.currentTarget`.

## Declaration Types

```ts
type MakooComponentDeclaration<TComponent = unknown, TProps = unknown> = Readonly<
  MakooComponentInput<TComponent, TProps> & { kind: 'component' }
>;

type MakooListenerDeclaration = Readonly<MakooListenerInput & { kind: 'listener' }>;
```

### `MakooInjectionDeclaration`

The element type of the array accepted by `apply()`:

```ts
type MakooInjectionDeclaration = MakooListenerDeclaration | MakooComponentDeclaration;
```

Declarations are fixed at `apply()` time; modifying the original object afterwards doesn't affect registered injections. To change selectors, timeouts, or other settings, `remove()` first and then `apply()` the new declaration.
