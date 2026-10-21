# Core Concepts

This page explains how Makoo approaches "adding features to someone else's page", and the terms that appear throughout the documentation. Reading it first makes it easier to choose the right API in the how-to guides.

## Two Stages

A Makoo project has two stages:

```text
Node: vite.config.ts → makoo() → development script or .user.js
                                     ↓ the script manager loads it on matching pages
Browser: src/main.ts → createMakoo() → apply([...]) → find targets → mount components / bind events
```

The toolchain turns the app into a userscript that a script manager can install, and `@match` decides which URLs the script runs on. Everything after that happens in the browser and is handled by Core: it finds elements on the page, puts components into them, listens to events on elements, and handles cleanup when the page changes.

`@match` matches URLs, while `injectAt` / `listenAt` match elements inside the page once that URL is open. These are two different layers of conditions.

## Core Instance

`createMakoo()` returns a Core instance. It is a management scope: the components and listeners registered in it are started, queried, and destroyed by it.

- A page can have several instances; names only mean something within their own instance.
- An instance holds its registered adapters, and each component selects one of them by name.
- An instance shares one set of DOM observation, used by every injection for finding targets and detecting invalidation, instead of each feature opening its own `MutationObserver`.

Most scripts only need to create one instance in the entry.

## Declarations and Injections

`inject()` and `listen()` produce **declarations**: configuration describing "what I need", which does nothing on its own. Declarations can be written in their own feature modules and handed to the entry together.

Only after a declaration is passed to `core.apply()` does it become a running **injection**. There are two kinds of injection:

- **Component**: a framework component plus its attached listeners.
- **Standalone listener**: a host listener that belongs directly to the instance and is not attached to any component.

Every injection has an **injection name**. The name is a stable business identifier used to get control handles; it has nothing to do with the DOM or selectors.

## Standalone and Attached Listeners

A host listener is bound to an element of the host page, such as the site's own buttons, videos, or input fields. It is not for listening to elements inside a component; use your framework's own syntax for events inside components.

| | Standalone listener | Attached listener |
| --- | --- | --- |
| Where it is written | Directly in `apply([...])` | In `inject({ listeners: [...] })` |
| Who owns it | The Core instance | Its owning component |
| When it runs | Starts and stops on its own | Starts after the component mounts, and stops when the component's current round ends (stop, reinjection, failure, or removal) |
| Can it be controlled separately | Has its own command handle | Status can only be read |
| After the target becomes invalid | Decided by its own `reinject` | The component's `reinject` decides whether to recover locally |
| On execution failure | Affects only itself | Wait timeouts, bind failures, and recovery failures all end the whole component |

The choice is simple: does this listener still make sense without the component? If yes, use a standalone listener. If it is part of the component's feature (for example, a site button that a panel depends on), use an attached listener.

## Mount Target and Component Container

The host element that a component finds through `injectAt` is called the **mount target**. Core does not render the component directly into the mount target; it appends a dedicated **component container** to the end of it, and the component is mounted only in the container.

This has two benefits: the host's existing content is not overwritten by the framework, and unmounting only needs to remove the container without working out which nodes it added.

## Adapters

Core depends on no framework. A **component adapter** handles the actual framework mounting and unmounting, and passes commands and status to the component. `@makoojs/vue` and `@makoojs/react` each provide one, named `'vue'` and `'react'`.

Adapters must be registered explicitly, and components must explicitly state `adapter: 'vue'`. Makoo does not guess the framework from the component's shape or file extension, so one instance can use Vue and React components at the same time.

## Command and Status Handles

Every top-level injection exposes two handles:

- **Command handle**: `start()`, `stop()`, `remove()`, expressing "I want it to run / stop / go away".
- **Status handle**: the read-only current status, subscribable, along with the most recent error `lastError`.

Control and reading are separated so that code that only cares about status (such as an indicator light) cannot trigger control by mistake, and code that only sends commands (such as a close button) doesn't have to subscribe to status.

Handles are obtained by name: external code uses `core.injection(name)` for components and `core.listener(name)` for standalone listeners, and components use the framework APIs. A settings page or shortcut module doesn't need the entry module to pass variables down through layers.

A handle is bound to **that particular injection**, not just its name. After the injection is removed, an old handle does not switch to controlling a same-named injection registered later.

## Status Only Expresses Availability

Component statuses are `idle`, `waiting`, `mounted`, and `failed`; listener statuses are `idle`, `waiting`, `bound`, and `failed`. They answer only one question: can this feature be used right now?

**Business events** on the host page, such as clicks or playback, are not status. When an event fires, the listener status is still `bound`, and business logic happens in the event handler; when the component needs to be notified, pass it through shared business data or functions.

## Next Steps

- To learn what one mount goes through from start to finish: [Injection Lifecycle](./lifecycle.md).
- To get hands-on: [Mount Components](./injection.md), [Listen to Page Events](./listeners.md).
