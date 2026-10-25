# Makoo Core

Makoo Core's domain is mounting components into host pages, binding host events, and keeping those injections alive. This glossary describes the ubiquitous language of the [Core architecture](./docs/architecture/core.md).

Each term keeps its original Chinese name in parentheses to match the Chinese specs.

## Language

### Features and ownership

**Core Instance** (Core 实例):
The management scope that owns a set of injections and their adapters; same-named injections in different instances are not the same injection.
_Avoid_: global singleton, generic task engine

**Declaration** (声明):
A description of the configuration a component or host listener needs; by itself it is not a running injection.
_Avoid_: running instance, mount callback

**Injection** (注入):
A component, Each Injection, or standalone listener that belongs directly to a Core Instance and has its own name and control entry.
_Avoid_: generic Task, new product feature, framework component instance

**Component** (组件):
An injection made of one framework component together with its attached listeners. It may use a standalone listener in the same Core Instance without owning that listener.
_Avoid_: single mount, framework component instance

**Each Injection** (Each 注入):
An injection that mounts the same framework component on every host element matching its selector, including elements that start matching while it runs, under one name and one control entry.
_Avoid_: component group, multi-component, list injection

**Child Injection** (子注入):
What an Each Injection mounts on one matching element: it has its own command and status handle but no top-level name and no attached listeners, and once it leaves its Each Injection it cannot rejoin.
_Avoid_: top-level injection, attached listener, framework child component

**Host Listener** (宿主监听):
An event listener on host page elements, covering both standalone and attached listeners.
_Avoid_: component-internal event, state subscription, DOM observation

**Standalone Listener** (独立监听):
A host listener that belongs directly to a Core Instance, with its own command and status, and is not part of any component.
_Avoid_: attached listener, component listener

**Attached Listener** (附属监听):
A host listener that belongs to a component and together with it forms a complete injection; its target is still a host page element, not an element inside the framework component.
_Avoid_: component-internal listener, independently controllable top-level injection

**Injection Name** (注入名称):
The stable business identifier of an injection within its owning scope; top-level names belong to the Core Instance, attached listener names belong to their component.
_Avoid_: DOM identity, selector, execution id

**Component Adapter** (组件适配器):
A named integration between a frontend framework and Core's component mounting, unmounting, and component-side capabilities.
_Avoid_: automatic component detector, injection scheduler

### Host elements and execution

**Mount Target** (挂载目标):
The host page element a component or Child Injection finds through its selector and uses to hold the component container.
_Avoid_: component container, component root node

**Component Container** (组件容器):
The element Core creates inside the mount target exclusively for this framework component mount.
_Avoid_: mount target, host container

**Listener Target** (监听目标):
The actual host page element a given host event binding attaches to.
_Avoid_: listener selector, component container

**Component Execution** (组件执行):
One run of a component, starting from waiting for the mount target and ending when this round's mount and attached listener resources have been fully cleaned up. A Child Injection's execution starts at the element it was given and does not wait.
_Avoid_: the injection itself, generic lifecycle

**Listener Execution** (监听执行):
One target lookup and binding lifetime of a host listener; the same listener can have several listener executions over time.
_Avoid_: the host listener itself, a single business event

**Reinjection** (整体重注入):
The recovery process that, after the original mount target or component container becomes invalid, ends the old component execution and looks for a mount target again.
_Avoid_: framework component re-render, local recovery of an attached listener, manual start

**Listener Recovery** (局部恢复):
The recovery process that, after a listener target becomes invalid, re-establishes only the affected listener execution; for an attached listener, the framework component and other listeners stay in place.
_Avoid_: reinjection, component rebuild

### Control and status

**Command** (命令入口):
A stable action entry (start / stop / remove) bound to one injection identity; an old injection's entry is not the entry of a later same-named injection.
_Avoid_: declaration, framework component instance, internal execution object, state subscription, latest diagnostic

**Status Handle** (状态入口):
A read-only entry for an injection's current status; a component's status handle can also return the status view of an attached listener by name. It also provides a `lastError` read that does not subscribe.
_Avoid_: the status string itself, control action, business store, event bus

**Status** (状态):
The current run phase of a component: not yet run or stopped, waiting for a target, mounted, or failed. A Child Injection uses the same phases. An Each Injection instead is not yet run or stopped, collecting (running, with or without matches), or failed.
_Avoid_: status handle, listener status, business store

**Listener Status** (监听状态):
The current availability of a host listener: not yet run or stopped, waiting for a target, bound, or failed.
_Avoid_: video playback state, click event, page DOM change

**StateView** (状态视图):
A read-only presentation of run state that provides snapshot reads and subscriptions; the snapshot keeps the same identity while the state is unchanged.
_Avoid_: ReadableState, event bus, command

**Host Business Event** (宿主业务事件):
A business event such as a click or play that happens on a listener target; an event occurring does not mean the listener's availability changed.
_Avoid_: listener status change, lifecycle notification

**Instance Observation** (实例观察):
A read-only subscription on a Core Instance for a closed set of instance-level notices that a single injection's Status Handle cannot express; it does not emit, does not schedule work, and is not available inside mounted components.
_Avoid_: ObserverHub, event bus, user lifecycle hook, StateView, DOM observer

**Observation Notice** (观察通知):
One of the closed notice kinds delivered by instance observation after the corresponding fact is committed: injection removed, instance disposed, or a diagnostic that does not change status.
_Avoid_: ObserveEvent, task event, lifecycle hook payload, status snapshot

### Errors

Errors are grouped by where they surface and who must act on them, not by what went wrong.

**Configuration Error** (配置错误):
An invalid declaration, batch, or adapter registration, reported before any of the batch runs so that nothing in it starts.
_Avoid_: usage error, validation failure, execution failure

**Control Error** (控制错误):
A call that is not allowed in the current state or context, such as controlling an unknown, removed, or cleanup-failed injection, or using a framework hook outside a mounted component.
_Avoid_: configuration error, cleanup failure

**Execution Failure** (执行失败):
A problem that ends one component or listener execution, such as a wait timeout, mount failure, lost target, or binding failure; once cleanup succeeds the injection can be started again.
_Avoid_: callback error, cleanup failure, crash

**Cleanup Failure** (清理失败):
A teardown step that failed, leaving Core unable to confirm that no resources remain; the injection stays closed (ADR 0001).
_Avoid_: execution failure, control error, retryable error

**Callback Error** (回调异常):
An exception thrown or rejected by code that Core calls but does not own, such as a host listener's event handler or a status subscriber; it is reported and does not change status or end the execution (ADR 0002).
_Avoid_: execution failure, handler failure
