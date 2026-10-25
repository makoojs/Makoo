# Adapter Contract

A component adapter connects a frontend framework to Core's mounting and unmounting. `@makoojs/vue` and `@makoojs/react` already provide adapters; usually you only need to register one:

```ts
core.useAdapter(createVueAdapter());
```

This page lists the contract an adapter must satisfy, for reference when reading the source or integrating another framework. Types are imported from `@makoojs/core`.

## `MountAdapter`

```ts
interface MountAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
  readonly name: string;
  mount(params: AdapterMountParams<TComponent, TProps>): THandle;
  unmount(mountHandle: THandle): void;
}
```

| Member | Description |
| --- | --- |
| `name` | Adapter name, selected by the `adapter` field of component declarations; unique within an instance |
| `mount(params)` | Synchronously mounts the component into `params.container` and returns a mount handle |
| `unmount(mountHandle)` | Synchronously unmounts the mount returned by `mount()` |

Core only stores the mount handle without reading its contents, and passes it back to `unmount()` as-is when unmounting.

## `AdapterMountParams`

```ts
interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
  component: TComponent;
  injection: ComponentInjection;
  props: TProps | undefined;
  container: HTMLElement;
  listener(name: string): ListenerInjection;
}
```

| Field | Description |
| --- | --- |
| `component` | The `component` from the declaration |
| `props` | The `props` from the declaration, or `undefined` if not provided |
| `container` | The component container Core created for this mount |
| `injection` | The owning component's injection object, containing the command handle `command` and the status handle `statusHandle`; the same object `core.injection(name)` returns. For a Child Injection of an Each Injection, it is that Child's entry in `children` |
| `listener(name)` | Finds a standalone listener in the same instance and returns `{ command, statusHandle }` |

`listener(name)` throws `MAKOO_INJECTION_NOT_FOUND` when the name doesn't exist, belongs to a component, or is only an attached listener.

## Behavior Conventions

### Mounting

- A normal return from `mount()` counts as a successful mount. Core doesn't wait for the framework's first render or effects to finish.
- After `mount()` returns, Core starts the attached listeners only if this round hasn't been stopped and the mount target and component container are still valid; otherwise it unmounts this mount directly.

### Mount Failure

- Throw the original error directly; Core wraps it as `MAKOO_MOUNT_FAILED` with the original value in `cause`.
- Before throwing, the adapter should release the framework resources it created in this attempt.
- If releasing also fails, or you can't confirm everything was released, throw a `MakooAggregateError` with `code` set to `MakooErrorCode.MOUNT_CLEANUP_FAILED`, `cause` set to the original mount error, and `errors` set to the release errors. Core treats it as a cleanup failure and closes the injection: `lastError` is `MAKOO_INJECTION_CLEANUP_FAILED`, whose `errors` are, in order, `MAKOO_MOUNT_FAILED` (with `cause` set to the original mount error) and each error the adapter provided.

### Unmounting

- `unmount()` runs synchronously. Core removes the component container only after it returns normally.
- If it throws, Core wraps the error as `MAKOO_UNMOUNT_FAILED`, counts it as a cleanup failure, and still tries to remove the container.

### Component-side Capabilities

How `injection` and `listener` are handed to components is up to the adapter. The Vue adapter hands them to [`useMakooComponent()`](./vue.md#usemakoocomponent) through `provide`, and the React adapter hands them to [hooks](./react.md#hooks) through Context. When the component unmounts, the adapter should release status subscriptions created inside the component.
