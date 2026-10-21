# Core API

`@makoojs/core` runs in the browser: it creates Core instances, declares components and listeners, reads status, and handles errors. If this is your first time, complete the [Quick Start](../docs/getting-started.md) first.

## Export Index

### Functions

| Export | Purpose | Reference |
| --- | --- | --- |
| `createMakoo()` | Create a Core instance | [Core Instance](./instance.md#createmakoo) |
| `inject()` | Declare a component | [Declarations](./declarations.md#inject) |
| `listen()` | Declare a host listener | [Declarations](./declarations.md#listen) |

### Classes and Constants

| Export | Purpose | Reference |
| --- | --- | --- |
| `MakooError` | Errors thrown or reported by Makoo | [Errors](./errors.md#makooerror) |
| `MakooAggregateError` | Collects multiple child errors | [Errors](./errors.md#makooaggregateerror) |
| `MakooErrorCode` | Core error codes | [Errors](./errors.md#makooerrorcode) |

### Types

| Type | Reference |
| --- | --- |
| `MakooRuntime` | [Core Instance](./instance.md#makooruntime) |
| `ComponentInjection`, `ListenerInjection` | [Core Instance](./instance.md#injection) |
| `MakooComponentInput`, `MakooComponentDeclaration` | [Declarations](./declarations.md#makoocomponentinput) |
| `MakooListenerInput`, `MakooListenerDeclaration` | [Declarations](./declarations.md#makoolistenerinput) |
| `MakooInjectionDeclaration` | [Declarations](./declarations.md#makooinjectiondeclaration) |
| `ComponentCommand`, `ListenerCommand`, `InjectionCommand` | [Commands and Status](./status.md#command-handle) |
| `ComponentStatusHandle`, `ListenerStatusHandle`, `InjectionStatusHandle` | [Commands and Status](./status.md#status-handle) |
| `ComponentStatus`, `ListenerStatus` | [Commands and Status](./status.md#status-values) |
| `StateView` | [Commands and Status](./status.md#stateview) |
| `ObservationNotice`, `ObservationHandler` | [Commands and Status](./status.md#instance-observation) |
| `MountAdapter`, `AdapterMountParams` | [Adapter Contract](./adapters.md) |

## Minimal Example

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import Panel from './Panel.vue';

const core = createMakoo();
core.useAdapter(createVueAdapter());
core.apply([
  inject({ name: 'panel', injectAt: 'body', adapter: 'vue', component: Panel })
]);
```

For the APIs used inside Vue and React components, see [Vue](./vue.md) and [React](./react.md).
