# @makoojs/core

`@makoojs/core` is Makoo's framework-agnostic runtime core. It declares injection tasks, starts task batches, waits for target DOM nodes, mounts artifacts, manages alive reinjection, binds event listeners, and provides lifecycle observation, logging, and error infrastructure.

> [!NOTE]
> `@makoojs/core` provides Makoo's public runtime protocol. Other Makoo packages use its types and capabilities directly or indirectly.

## Use Cases

- Write a custom `ResolvableMountAdapter` so Makoo can mount a new artifact type.
- Create a Makoo runtime with `createMakoo()` and start explicit task declarations.
- Listen to injection lifecycle events for debugging, analytics, error reporting, or visual devtools.
- Use low-level tools such as `DOMWatcher` and `createActivityStore` for custom integrations.

## Installation

```bash
# npm install @makoojs/core
# yarn add @makoojs/core
pnpm add @makoojs/core
```

## Minimal Runtime Example

```ts
import {
	createMakoo,
	inject,
	type ResolvableMountAdapter
} from '@makoojs/core';

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

const makoo = createMakoo({
	defaults: {
		alive: true,
		scope: 'local',
		timeout: 5000
	},
	adapters: [textAdapter]
});

makoo.start([
	inject({
		id: 'text',
		injectAt: '#app',
		artifact: {
			kind: 'text',
			text: 'Hello from Makoo core'
		}
	})
]);
```

## Runtime Basics

`inject()` and `listen()` declare tasks. They do not touch the DOM or register tasks by themselves. `makoo.start([...])` registers the declarations in the provided batch and immediately schedules those tasks.

`inject()` accepts an object containing the target, artifact, and task options. Its optional `id` is used as the task ID, which is useful when you want to look up or control that task later:

```ts
inject({
	id: 'settings-panel',
	injectAt: '#settings',
	artifact: settingsArtifact,
	options: {
		alive: true
	}
});
```

When `id` is omitted, Makoo infers a task id from the artifact and target selector.

```ts
import { createMakoo, inject, listen } from '@makoojs/core';

const makoo = createMakoo({
	defaults: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	adapters: [myAdapter],
	hooks: {
		'start:requested': (event) => {
			console.log(event.name);
		}
	}
});

const started = makoo.start([
	inject({
		id: 'toolbar',
		injectAt: '#toolbar',
		artifact: toolbarArtifact,
		options: {
			alive: true
		}
	}),
	inject({
		id: 'settings-panel',
		injectAt: '#settings',
		artifact: settingsArtifact,
		options: {
			alive: true
		}
	}),
	inject({
		id: 'save-tip',
		injectAt: '#save-tip',
		artifact: saveTipArtifact,
		options: {
			on: listen({
				listenAt: '#save',
				type: 'click',
				callback: () => {
					console.log('save clicked');
				}
			})
		}
	}),
	listen({
		id: 'escape-close',
		listenAt: '#escape',
		type: 'keydown',
		callback: onEscape
	})
]);
```

`start()` returns `StartedTasks` for batch-scoped control:

```ts
const toolbar = started.get('toolbar');

if (toolbar?.kind === 'component') {
	toolbar.disableAlive();
	toolbar.enableAlive();
}

started.destroyAll();
```

`started.destroyAll()` only affects tasks created by that start batch. `makoo.destroyAll()` affects the whole runtime.

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
		return {
			handle,
			instance
		};
	},
	unmount(input) {
		// Clean up according to input.reason.
	}
};
```

`mount(input)` receives the target host, generated mount point, artifact, task ID, selector, and task-scoped `makoo` context.

## Listener And Activity Signal

Standalone listeners use the object form of `listen()`. Their optional `id` is the task ID;
use it when later task lookup or control needs a stable identity. A component's `on` listener
is owned by that component task and does not need its own ID.

`capture` defaults to `false`. Set it to `true` to run the listener during the DOM capture phase.

```ts
import { createActivityStore, createMakoo, listen } from '@makoojs/core';

const enabled = createActivityStore(true);
const makoo = createMakoo();

makoo.start([
	listen({
		id: 'save-listener',
		listenAt: '#save',
		type: 'click',
		callback: () => {
			console.log('save clicked');
		},
		activitySignal: () => enabled
	})
]);

enabled.set(false);
enabled.set(true);
```

## Observation Events

core emits observation events during declaration registration, starting, mounting, listener work, alive mode, DOM watching, and task status changes.

```ts
const off = makoo.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId, event.injectAt);
});

makoo.onAny((event, ctrl) => {
	if (event.name === 'artifact:mountFail') {
		ctrl.stopPropagation();
	}
});

off();
```

Common events include:

- `register:start`
- `register:success`
- `start:requested`
- `start:taskScheduled`
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

`DOMWatcher` is core's low-level DOM observation utility. You usually do not need to use it directly because `makoo.start()` and alive mode already wrap target waiting and restoration.

## Logging And Errors

core uses `Logger` by default and prints logs with the `[Makoo]` prefix. You can pass a custom logger to `createMakoo({ logger })`.

core also exports these error-related types:

- `MakooError`
- `AdapterError`
- `TaskError`
- `SignalError`
- `ErrorCode`
- `MakooIssue`

## Public Exports Overview

| Category | Representative exports |
| --- | --- |
| Runtime API | `createMakoo`, `inject`, `listen`, `MakooRuntime`, `StartedTasks` |
| Adapter protocol | `MountAdapter`, `ResolvableMountAdapter`, `AdapterMountInput`, `AdapterUnmountInput`, `MakooContext` |
| Lifecycle observation | `ObserverHub`, `OBSERVE_EVENT_NAMES`, `ObserveEvent`, `ObserveHook`, `LifecycleHookMap` |
| DOM observation | `DOMWatcher` |
| Listener signal | `createActivityStore`, `ActivitySignalSource` |
| Logging | `Logger`, `ILogger`, `LoggerLevel` |
| Errors | `MakooError`, `AdapterError`, `TaskError`, `SignalError`, `ErrorCode` |
