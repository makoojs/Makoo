# Core Rewrite Architecture

Updated: 2026-10-03. This document records the first-version core architecture. The rewrite was completed on 2026-10-02, and the directories and internal interfaces below match the current source.

## Sources and document responsibilities

- [CONTEXT.md](../../CONTEXT.md): ubiquitous domain language; defines only concepts and their relationships.
- Behavior spec, `.scratch/core-rewrite/spec.md` (local only, not committed): external behavior, failure policy, scope, and acceptance requirements.
- This document: domain directories, dependency direction, internal collaboration, resource ownership, and execution structure.
- Design discussion notes, `.scratch/core-rewrite/design.md` (local only, not committed): the original planning source. Later architecture decisions have converged into this document; earlier open questions there do not override the current design.

The repository has no separate plan file; this document combines the design, the spec, and later architecture interviews. When terminology, behavior, and architecture conflict, point out the conflict and fix the corresponding source document instead of letting the implementation invent new behavior.

## Scope and backbone

Externally, core receives declarations and control requests through a single surface; internally, work is split by domain. The instance layer manages the whole, injections and listeners each schedule their own executions, and core decides when framework mounting and unmounting happen while adapters perform the actual operations.

The rewrite covered core plus the necessary Vue/React integration. The CLI, scaffolding, generic hooks, logger, external observer system, and Runtime Inspector were not part of its acceptance. Shared DOM observation and minimal state subscription were required capabilities and are not part of the deferred observation platform.

Use explicit resource owners and direct calls. The first version does not build a generic Task engine, generic feature controller, internal event bus, or generic resource manager; a small amount of similar control code is not a reason to extract such facilities early.

## Domain directories

Directories represent clear responsibilities and file names indicate where implementation lives.

```text
packages/core/src/
├─ index.ts
├─ core/
│  ├─ createMakoo.ts
│  └─ types.ts
├─ component/
│  ├─ declaration.ts
│  ├─ component.ts
│  ├─ execution.ts
│  └─ types.ts
├─ listener/
│  ├─ declaration.ts
│  ├─ listener.ts
│  ├─ attach.ts
│  ├─ execution.ts
│  └─ types.ts
├─ dom/
│  ├─ observer.ts
│  ├─ waitForElement.ts
│  └─ watchElement.ts
├─ adapter/
│  ├─ registry.ts
│  └─ types.ts
├─ state/
│  ├─ createState.ts
│  └─ types.ts
└─ error/
   ├─ MakooError.ts
   └─ ErrorCode.ts
```

| Domain | Owns | Does not own |
| --- | --- | --- |
| core | Instance assembly, batch validation coordination, top-level name registration, control entry lookup, whole-instance disposal | Concrete cleanup of individual mounts and listener resources |
| component | Component declarations and their validation, long-lived control intent, execution switching, lifetime of the component and its attached listeners as a whole | Host event binding details, framework-internal instance structure |
| listener | Listener declarations and their validation, stable status, single lookup and binding, local recovery, unbinding | Component mounting, directly modifying the parent injection |
| dom | Per-instance shared observation, waiting for targets, timeout and cancellation, validity notifications | Deciding reinjection, unmounting components, starting or stopping features |
| adapter | Named registration, lookup, framework-agnostic mount and unmount contract | Implementing Vue/React operations inside core |
| state | State snapshots and subscription | Driving mounting, cleanup, or recovery through subscriptions |
| error | Structured diagnostics, error classification | Deciding recovery policy, a full logging system |

The root entry exports only public capabilities and public types. Domain types live with their domain, internal execution types stay internal, and there is no large type file that centralizes every domain's state. Actual Vue/React mounting, unmounting, and component state integration live in their respective adapter packages.

## Call direction and dependency passing

```text
core
├─→ component ──→ listener (attached)
├─→ listener (standalone)
├─→ adapter registry
└─→ shared dom instance

component ──→ selected adapter, shared dom, state, error
listener  ──→ shared dom, state, error
```

Callers request work through explicit interfaces; callees report back through callbacks provided at creation or through explicit return values. A listener does not import and modify its owning injection, and DOM does not depend back on injections or listeners. Dependencies are passed as plain parameters, ordinary utility functions can be imported normally, and no dependency injection framework is introduced.

### Instance assembly

1. Each core instance holds its own feature registry, adapter registry, and shared DOM capability.
2. Declaration entries only produce configuration and do not touch the DOM. Each owning domain validates its own kind of configuration; the instance layer coordinates batch validation, name conflicts, and adapter existence.
3. Only after the whole batch passes basic validation are all top-level features and their stable entries created and registered, and only then is execution requested; constructing a feature object does not mount early.
4. An injection object prepares its attached listener objects and status views before the component mounts.
5. A single failure during actual execution affects only its owning feature and does not roll back other accepted features.

### What an injection receives

| Input | Purpose |
| --- | --- |
| Validated injection configuration | Fixes this feature's execution requirements |
| The selected adapter | Mounting and unmounting; the injection does not query the adapter registry itself |
| Shared DOM interface | Waiting for targets, observing validity |
| Removal-complete callback for this record | After successful cleanup and removal, tells core to unregister the corresponding record |

The removal callback is bound to the record's identity rather than deleting by name alone, so stale results cannot affect a later feature with the same name. A cleanup failure does not trigger a successful unregistration.

An injection creates its own attached listeners, passing in their configuration, the inherited recovery policy, the shared DOM capability, and the failure receiver, without passing down the whole core/runtime context. The component receives the command entry and the status entry, not the internal feature object. The execution layer knows neither entry: at creation the component wraps adapter mounting into a mounter, and execution only calls `mount` / `unmount`.

## Feature lifetime and execution lifetime

```text
Injection feature (long-lived)
├─ fixed configuration, control intent, control entries, external status
├─ attached listener objects and stable StateView
└─ current injection execution (created per round)
   ├─ this round's phase, cancellation signal, end result
   ├─ mount target, component container, adapter handle
   └─ starting and stopping this round's attached listener executions

Listener object (standalone or attached)
├─ fixed configuration, stable status, recovery scheduling
└─ current listener execution (created per round)
   └─ this round's cancellation signal, actual target, observation and event binding
```

The long-lived object decides whether to start the next round; a single execution is responsible for this round's resources and full teardown and cannot create the next round itself. Both components and standalone listeners separate the public start from creating the next execution: `startComponent` / `startListener` checks for cleanup failure and removal, records the run intent, and clears `lastError`, then calls `startExecution` when the execution slot is empty; `startExecution` only creates and starts an execution, without changing intent or clearing `lastError`. Resuming after an explicit stop goes through the public start, while reinjection after target invalidation calls `startExecution` directly. Stopping keeps the long-lived object; successful removal unregisters it from its owning scope. Old objects and old executions always belong to the old identity and are never re-associated with a new feature through a same-name lookup.

Attached listener objects and their status entries stay with the owning injection; when the parent execution ends, what ends is each listener's current execution. Reinjection reuses the stable entries and builds new execution resources. State subscriptions created by the component are released when the component unmounts, and are not kept alive just because the status entry still exists.

Long-lived state is named `Component`, `Listener`, and `AttachListener`. `Listener` represents a standalone listener and holds the unregister callback; its public side is split into the command entry `ListenerCommand` (start / stop / remove) and the status entry `ListenerStatusHandle` (the status view plus a non-subscribing `lastError`). `AttachListener` represents an attached listener; it must be given a failure receiver callback, holds no unregister callback, and has no removed intent or execution status. A component only holds `attachListeners: Map<string, AttachListener>` and operates through the attached listener entry points directly. The component's public side is likewise split into `ComponentCommand` and `ComponentStatusHandle`; the latter provides `listenerNames`, `listener(name)`, and a non-subscribing `lastError` in addition to the status view.

`listener/listener.ts` manages standalone listener control entries plus the shared long-lived intent, status, execution switching, and recovery scheduling. `listener/attach.ts` holds the attached listener types, the create entry point, and the group stop logic; components use `createAttachListener` and `stopAttachListeners` directly from this file. `listener/execution.ts` handles single-round target lookup, event binding, and resource release. Like `Component`, `Listener` and `AttachListener` keep the current execution and its cleanup-complete Promise in an `executionSlot`. They share `ListenerExecution`, which only holds this round's configuration reference, cancellation signal, actual target, event handler, and cleanup errors; it does not carry completion notification for public control and does not provide a second set of run methods. The files collaborate through explicit function calls and result callbacks; `listener.ts` references `attach.ts` only for types and has no runtime circular call dependency on it. Executions use `active`, `cancelled`, `cleaning`, and `settled` to express validity and cleanup progress, while waiting and binding availability is still expressed by the public status.

After successful cleanup the execution slot becomes `empty`, keeping only the settled Promise and not the whole execution object; after a cleanup failure it becomes `cleanup-failed`, keeping the completion Promise and the cleanup errors. Repeated stops wait for the same cleanup and reuse its result, without requiring the returned Promise to be the same object; cleanup failure is expressed explicitly by the execution slot and is not inferred from the latest diagnostic. Like `createComponent`, `createListener` initializes the long-lived data and returns the public command and status entries; attached listeners build their long-lived data through `createAttachListener` without creating public entries. Single-item control calls `startListener`, `stopListener`, and `removeListener`. A component starts each attached listener through the shared `startListener`, which accepts both `Listener` and `AttachListener`, and stops the whole group through `stopAttachListeners`, which accepts only `AttachListener`; the shared execution flow stays inside the listener domain, and the public declaration API does not change.

### Both kinds of listener share the full implementation

| Difference | Standalone listener | Attached listener |
| --- | --- | --- |
| Owner | core | Owning injection |
| Recovery configuration | Its own declaration | The owning injection's configuration |
| Public entry | Start, stop, remove, and status reads | Read-only status entry |
| Execution failure | Ends itself | Reports to the owning injection, whose parent ends the whole |

The listener's internal stop capability exists for resource management and does not mean attached listeners expose independent start/stop to users. What is shared is the listener implementation, not a unified execution base class for every feature.

## Control intent, execution phase, and external status

These three express different facts and must not be collapsed into a single status:

- The long-lived object stores control intent: whether the user currently wants it running, stopped, or has requested removal.
- A single execution stores the phases it needs, such as waiting for a target, mounting, mounted, cleaning up, and ended; phase names are internal and do not automatically become public enums or hooks.
- The status view expresses the run availability callers need to know and does not expose every internal phase.

Phases help handle synchronous reentrancy: when a stop is requested while a component is initializing, the mounting execution is invalidated first; after the synchronous mount returns and the handle is obtained, cleanup is completed. Before that return, the round must not be declared cleaned up and the next round must not be created. This does not establish an asynchronous unmount or unmount timeout protocol.

## Cancellation, cleanup, and result handoff

Each injection execution and each listener execution creates its own native AbortController; a new execution uses a new signal. DOM waiting and validity observation receive the signal of their owning execution, unregister on stop, and late callbacks still check cancellation state and execution ownership.

The parent ends its children by invalidating all attached executions through explicit stop calls, without building a separate signal tree. Cancelling a single listener does not affect the component or other listeners. The signal is an internal cancellation mechanism, not a user-facing activitySignal, and it does not replace resource cleanup.

`stopAttachListeners` first updates the stop intent of every attached listener and invalidates their executions, then cancels observation, unbinds, and publishes status one by one. The parent calls only this entry point; the listener domain guarantees that all attached executions are invalidated before the first `await`. The listener group and injection cleanup hand off sequentially through `async/await`, uniformly returning a Promise of the collected cleanup errors. If a listener is already cleaning up, its result is reused and awaited; individual failures are still collected as named errors and the remaining cleanup continues.

The long-lived control layer keeps each round's completion signal to handle stops during mounting and synchronous reentrancy during cleanup; single-round resource cleanup does not receive its resolve/reject. Stop intent takes effect immediately, while full resource release, final status publication, and name release after removal are bound to the completion of the control operation, with no promise that they finish before the call returns its Promise. Adapter unmounting and native event unbinding remain synchronous operations, and the next round must not start while cleanup is pending.

Injection execution ends in this order:

1. Invalidate this round and stop its own waiting, validity observation, and any further progress.
2. Stop all attached listeners, revoking their waiting, observation, and event bindings.
3. Call adapter unmount synchronously.
4. Remove this round's component container.
5. Collect and deliver this round's end result.

If a step fails, the remaining executable steps are still attempted. A round's cleanup runs only once and repeated requests share its result; release actions are not registered into a single list whose registration order drives business cleanup.

The internal end result separately expresses the end reason, the original execution error, and the collection of cleanup errors. The reasons are explicit stop, target invalidation, and execution failure. When cleanup produced errors, the public diagnostic is one new `MakooAggregateError` (`INJECTION_CLEANUP_FAILED`): the execution error first, then each cleanup step. That object is both `lastError` and the rejection of `stop` / `remove`. `dispose` wraps those aggregates in `INSTANCE_CLEANUP_FAILED`. An attached listener does not build its own cleanup aggregate; its cleanup errors are merged into the component's list.

| Result | Next step for the long-lived object |
| --- | --- |
| Explicit stop with successful cleanup | Stop; if a later valid start request arrived during teardown, follow the latest intent |
| Target invalidation with successful cleanup | Decide whether to run again based on the latest intent and recovery configuration |
| Execution failure with successful cleanup | Stop automatic retries; allow an explicit external start |
| Any reason with failed cleanup | Keep diagnostics and the name, cancel pending start requests, refuse restarts |

Internal structured handoff does not change the public contract: when an explicit stop, remove, or dispose fails to clean up, its completion Promise is still rejected; background teardown is caught and reported by core. The first version provides no cleanup retry and no way to force-forget a record.

## Shared DOM domain

Each core shares its own DOM observation capability rather than using a page-global singleton. The observer manages the underlying observation and registrations; waitForElement and watchElement use the same capability instead of each duplicating an observation system.

Two kinds of demand are maintained:

- Pending lookups: selector, this lookup's timeout budget, cancellation signal, result receiver.
- Pending observations: actual element, validity condition, cancellation signal, invalidation receiver.

A new lookup queries immediately first and only keeps waiting if nothing is found. On each MutationObserver callback, all current pending lookups and observations are checked together, rather than running a full check once per mutation record. A batch here is the set of records delivered by one observer callback, not a frame, a fixed time window, or an extra debounce.

Once a lookup completes it leaves the pending lookup set, and from then on what matters is the actual element, not whether it still matches the original selector. Validity is judged by the actual state at check time: disconnection caused by an ancestor's removal is detected, an element removed and reinserted within the same batch that is still valid is not rebuilt, and a component container must also remain inside its owning mount target.

Each lookup has its own budget, 15 seconds by default and configurable; ordinary DOM changes do not reset it. Completion, timeout, or cancellation releases that request's registration and timer resources without affecting other demands; when there is no demand, the underlying observation can be disconnected. The first version accepts the query cost of this simple checking and does not add complex incremental indexing or scheduling optimizations up front.

## StateView and framework integration

The unified name is StateView. The confirmed interface direction is below; concrete status types are maintained in their owning domains.

```ts
interface StateView<T> {
  getSnapshot(): Readonly<T>;
  subscribe(notify: () => void): () => void;
}
```

The injection or listener owns write access and exposes only the view. While state is unchanged the same snapshot is kept; when it changes, the snapshot is replaced and subscribers are notified. The view is not an internal mutable resource record and does not deep-freeze business data users pass into components.

Example listener statuses:

| Situation | Status |
| --- | --- |
| Not yet started or stopped normally | idle |
| Initial wait or local recovery | waiting |
| Successfully bound | bound |
| Timeout, binding failure, or target invalidation where recovery is not allowed | failed |

A host video firing play or a user clicking a button are business events; an event occurring does not by itself change the binding status. Business handlers communicate with components through business data or functions; StateView does not carry arbitrary business messages and does not drive core's execution flow.

Vue and React keep command and status awareness consistent, without requiring identical component-side APIs. External code gets the command entry through `core.command(name)` and the status entry through `core.status(name)`. Status snapshots are plain strings, such as `'mounted'` and `'bound'`.

Vue's `useMakooComponent()` automatically connects the component and all of its attached listeners; `status` and `listener(name)` return read-only refs, and `lastError` on the aggregate object reads the status entry without creating a subscription. Vue tracks updates based on the refs actually read during render. The fixed list of attached names comes from `status.listenerNames` on the status entry, and the mount arguments are `command` and `status`. Vue connects to StateView from these, and subscriptions are released with the effect scope.

React separates commands from status reads:

- `useComponentCommand()` returns a command entry that is reference-stable within this mount and creates no status subscription.
- `useComponentStatus()` subscribes only to the owning component's status.
- `useListenerStatus(name)` subscribes only to the named attached listener within the owning component and does not query global standalone listeners; when the name changes it switches subscriptions and releases the old one.
- `lastError` lives on the status entry; reading it does not subscribe and it is not part of the status snapshot.
- `useComponentStatusHandle()` returns the raw status entry, reference-stable within this mount, corresponding to external `core.status(name)`; components read `lastError` from it, and obtaining the entry itself creates no subscription.
- Without a selector, both status hooks return the full read-only snapshot; with a selector, they return the selected field or derived value. Selected results are compared with `Object.is`; destructuring a plain object does not become field-level subscription, and new objects built by a selector on each call are not deep-compared.

The React adapter's Context passes `{ command, status }` and does not subscribe to or aggregate status inside Context. Status hooks connect directly to the corresponding StateView and manage subscription and commit consistency through `useSyncExternalStore`; selected results are cached per source snapshot so React does not get a new object when it rechecks the same snapshot. Users do not need to convert StateView or manage release, but must still follow React's rule of calling hooks at the top level. Unrelated status does not trigger a render update for that subscription; there is no promise to prevent parent component updates or necessary core unmounts.

## Adapter and error ownership

Adapters are registered with useAdapter, and injection declarations select one explicitly by name; core completes the selection when it receives the declaration and passes the adapter into the injection. Core holds an opaque handle and passes it back unchanged at unmount, without reading framework internals.

Returning a mount result normally satisfies core's condition for continuing execution. React keeps the current boundary of returning a handle after root.render, without claiming that the first DOM commit or effects have completed. Unmount is a synchronous call, and the container is removed only after it returns normally.

The adapter tears down framework resources created before a mount failure. An ordinary `mount` or `unmount` throw is left raw; core wraps it once as `MOUNT_FAILED` or `UNMOUNT_FAILED`, with the raw value as `cause`. If mount fails and the adapter's own cleanup also fails, the adapter throws `MakooAggregateError` with core's `MOUNT_CLEANUP_FAILED`: `cause` is the original mount error and `errors` are the cleanup failures. Core then closes the injection. Hook misuse is a `MakooError` with the adapter package's own code. Event-handler and status-subscriber failures are reported and do not by themselves end the injection; a subscriber failure does not replace `lastError`. The error domain only defines `MakooError`, `MakooAggregateError`, and `MakooErrorCode`. The owning injection decides disposal.

## End-to-end scenarios and acceptance mapping

Verification enters through public declarations, core control entries, real DOM changes, and the adapter contract; internal directories, private fields, or helper call counts are not proof of correctness.

- First run: whole-batch validation and registration complete → stable status entries prepared → target found and mounted → attached listeners started. Verify call order and the component's initial status read.
- Attached listener invalidation: only that listener's current execution ends → status updates to waiting → new target found and bound; if recovery times out, the parent is notified to end the whole. Verify that the component and other listeners are kept.
- Mount target invalidation: DOM notification → this round is invalidated immediately → full cleanup → end result handed off → the long-lived object decides the next round. Verify that both stop intent and cleanup failure prevent recovery.
- Stop during mounting: the stop request takes effect before the synchronous mount returns → after the handle returns, only cleanup happens and listeners are not started. Verify that no new execution is let through early.
- Same-name rebuild after removal: old and new records are isolated; old callbacks, old control entries, and old status views cannot act on the new feature.
- Framework integration: a real component reads listener recovery status and releases subscriptions on unmount; React's mount success is not extended into a render-ready promise.

The behavior spec is the authority for the full acceptance checklist.
