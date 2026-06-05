# @makoojs/core

`@makoojs/core` is Makoo's framework-agnostic runtime core. It registers and schedules injection tasks, waits for target DOM nodes, mounts artifacts, manages alive reinjection, binds event listeners, and provides lifecycle observation events, logging, and error infrastructure.

Projects should usually start with `@makoojs/cli`. The CLI provides the Vite plugin, scans the `injections` directory, resolves manifests, generates userscript entry code, and passes configuration through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) for development, build, and install flows. `@makoojs/core` is the lower-level runtime package. You only need to use it directly when you want to leave Makoo's CLI flow and manually integrate the injection runtime. `@makoojs/vue` and `@makoojs/react` are component mounting adapters that connect Vue or React components to the `@makoojs/core` injection flow.

> [!NOTE]
> `@makoojs/core` is the parent package for the rest of Makoo. Other packages depend on its types or runtime capabilities either directly or indirectly.

## Use Cases

- Write a custom `ResolvableMountAdapter` so Makoo can mount a new artifact type.
- Create an `Injector` directly and register tasks manually without CLI scanning or code generation.
- Listen to injection lifecycle events for debugging, analytics, error reporting, or visual devtools.
- Use low-level tools such as `DOMWatcher` and `createActivityStore` to build a more custom runtime integration.

## Installation

```bash
// npm install @makoojs/core
// yarn add @makoojs/core
pnpm add @makoojs/core
```

## Minimal Runtime Example

The following example shows the basic core flow: create an `Injector`, register an adapter, register an artifact, then call `run()` to wait for the target DOM node and mount it.

```ts
import { Injector, type ResolvableMountAdapter } from '@makoojs/core';

type TextArtifact = {
	kind: 'text';
	text: string;
};

const textAdapter: ResolvableMountAdapter<TextArtifact, HTMLElement> = {
	name: 'text',
	matches(artifact): artifact is TextArtifact {
		return (
			typeof artifact === 'object' &&
			artifact !== null &&
			(artifact as { kind?: unknown }).kind === 'text'
		);
	},
	mount({ mountPoint, artifact }) {
		const el = document.createElement('span');
		el.textContent = artifact.text;
		mountPoint.appendChild(el);

		return { handle: el };
	},
	unmount({ handle }) {
		handle.remove();
	}
};

const injector = new Injector({
	alive: true,
	scope: 'local',
	timeout: 5000
}).applyAdapter(textAdapter);

injector.register('#app', {
	kind: 'text',
	text: 'Hello from Makoo core'
});

injector.run();
```

## Injector Basics

`Injector` is core's main entry point. It brings together task registration, DOM waiting, adapter resolution, mounting, event binding, and lifecycle control.

Common methods:

| Method | Description |
| --- | --- |
| `applyAdapter(adapter)` | Registers a mount adapter that can resolve artifacts |
| `register(injectAt, artifact, options?)` | Registers a component or other artifact injection task |
| `registerListener(listenAt, event, callback, activitySignal?)` | Registers a standalone DOM event listener task |
| `run()` | Starts scheduling registered tasks |
| `enableAlive(taskId)` / `disableAlive(taskId)` | Enables or disables alive reinjection for a component task |
| `reset(taskId)` / `destroy(taskId)` | Resets or destroys a single task |
| `resetAll()` / `destroyAll()` | Resets or destroys all tasks |
| `on()` / `onTask()` / `onAny()` | Listens to lifecycle observation events |

`register()` returns `taskId`, `isSuccess`, and shortcut methods for `enableAlive()` / `disableAlive()` on the current task.

## Adapter Contract

core does not care whether an artifact is a Vue component, a React component, or another object. It only requires adapters to implement a unified mounting protocol.

```ts
import type { ResolvableMountAdapter } from '@makoojs/core';

const adapter: ResolvableMountAdapter<MyArtifact, MyHandle, MyInstance> = {
	name: 'my-adapter',
	matches(artifact): artifact is MyArtifact {
		return isMyArtifact(artifact);
	},
	mount(input) {
		// input.host is the host element created by Makoo
		// input.mountPoint is where the adapter should mount content
		// input.makoo contains task-scoped runtime capabilities
		return {
			handle,
			instance
		};
	},
	unmount(input) {
		// Clean up according to input.reason
	}
};
```

`mount(input)` receives:

| Field | Description |
| --- | --- |
| `host` | The host element created and inserted by Makoo |
| `mountPoint` | The node where the adapter should mount content |
| `artifact` | The currently registered artifact |
| `taskId` | Current task ID |
| `injectAt` | Target selector for the current task |
| `makoo` | Task-scoped runtime capabilities |

The `makoo` context lets adapter internals control the current task:

```ts
mount({ makoo }) {
	const off = makoo.onTask('artifact:mountSuccess', (event) => {
		makoo.getLogger().debug('mounted', event.taskId);
	});

	return {
		handle: {
			off
		}
	};
}
```

## Lifecycle And Alive Mode

`alive` handles cases where the target DOM is re-rendered, removed, and later restored. When enabled, Makoo observes removal of the mounted node and tries to reinject when the target selector appears again.

```ts
const result = injector.register('#toolbar', artifact, {
	alive: true,
	scope: 'global',
	timeout: 8000
});

result.disableAlive();
result.enableAlive();
```

`scope` supports:

| Value | Description |
| --- | --- |
| `local` | Observes DOM changes near the current mount area |
| `global` | Observes DOM changes across the whole document |

`alive` only applies to component or artifact injection tasks. Standalone listener tasks do not use the alive reinjection mechanism.

## Listener And Activity Signal

Besides mounting artifacts, `Injector` can also register standalone DOM event listener tasks.

```ts
import { createActivityStore } from '@makoojs/core';

const enabled = createActivityStore(true);

injector.registerListener(
	'#save',
	'click',
	() => {
		console.log('save clicked');
	},
	() => enabled
);

injector.run();

enabled.set(false);
enabled.set(true);
```

`createActivityStore()` returns a small subscribable boolean state. When passed to a listener, Makoo automatically attaches or detaches the event listener based on that state.

> [!NOTE]
> `@makoojs/cli` cannot parse this standalone listener mounting form yet. It only supports the **`component + listener`** form.

## Observation Events

core emits observation events during registration, running, mounting, listener work, alive mode, DOM watching, and task status changes. You can listen to them with `on()`, `onTask()`, or `onAny()`.

```ts
const off = injector.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId, event.injectAt);
});

injector.onAny((event, ctrl) => {
	if (event.name === 'artifact:mountFail') {
		ctrl.stopPropagation();
	}
});

off();
```

Common events include:

- `register:start`
- `register:success`
- `run:start`
- `run:taskScheduled`
- `artifact:mountStart`
- `artifact:mountSuccess`
- `artifact:mountFail`
- `listener:attached`
- `alive:enabled`
- `alive:observerStarted`
- `task:statusChange`
- `dom:targetFound`
- `dom:targetTimeout`

The full event name list is available from `OBSERVE_EVENT_NAMES`.

## DOMWatcher

`DOMWatcher` is core's low-level DOM observation utility. You usually do not need to use it directly because `Injector.run()` and alive mode already wrap target waiting and restoration.

In a custom runtime, you can use it directly:

```ts
import { DOMWatcher } from '@makoojs/core';

const stop = DOMWatcher.onDomReady(
	'#app',
	(el) => {
		console.log('target ready', el);
	},
	document,
	{
		once: true,
		timeout: 5000
	}
);

stop();
```

`DOMWatcher.onDomAlive()` can observe removal and restoration of an existing node, mainly for implementing reinjection behavior.

## Logging And Errors

core uses `Logger` by default and prints logs with the `[Makoo]` prefix. You can pass a custom logger.

```ts
import { Injector, type ILogger } from '@makoojs/core';

const logger: ILogger = {
	info: console.info,
	warn: console.warn,
	error: console.error,
	debug: console.debug
};

const injector = new Injector({ logger });
```

core also exports these error-related types:

- `MakooError`
- `AdapterError`
- `TaskError`
- `ErrorCode`
- `MakooIssue`

These types are useful for error identification, log grouping, or user-facing messages in custom integrations.

## Public Exports Overview

The main `@makoojs/core` entry exports these groups of capabilities:

| Category | Representative exports |
| --- | --- |
| Injection scheduling | `Injector`, `InjectionConfig`, `ArtifactOptions` |
| Adapter protocol | `MountAdapter`, `ResolvableMountAdapter`, `AdapterMountInput`, `AdapterUnmountInput`, `MakooContext` |
| Lifecycle observation | `ObserverHub`, `OBSERVE_EVENT_NAMES`, `ObserveEvent`, `ObserveHook`, `LifecycleHookMap` |
| DOM observation | `DOMWatcher` |
| Listener signal | `createActivityStore`, `ActivitySignalSource` |
| Logging | `Logger`, `ILogger`, `LoggerLevel` |
| Errors | `MakooError`, `AdapterError`, `TaskError`, `ErrorCode` |

The full API reference will be moved to a dedicated documentation site later.

## Relationship To Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/core` | Framework-agnostic injection runtime core |
| `@makoojs/vue` | Vue adapter and Vue plugin registration helpers |
| `@makoojs/react` | React adapter |
| `@makoojs/cli` | Vite plugin, config resolution, scanning, code generation, and userscript build integration |
| `@makoojs/create-makoo` | Project scaffold |

If you are building a regular userscript project, prefer `@makoojs/cli` + `@makoojs/core`. If you want to extend Makoo's runtime capabilities, use `@makoojs/core` directly.
