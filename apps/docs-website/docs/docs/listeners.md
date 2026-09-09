# Event Listeners

`listen()` lets Makoo manage a DOM event listener. The following entry logs the target each time you click the page.

## Declare a listener

`src/main.ts`

```ts
import { createMakoo, listen } from '@makoojs/core';

const tasks = createMakoo().start([
  listen({
    id: 'page-click',
    listenAt: 'body',
    type: 'click',
    callback: (event) => console.log('Clicked:', event.target)
  })
]);
```

`listenAt` is the target element’s CSS selector, `type` is the event name, and `callback` receives the native DOM event. Run the development script, click the page, and check the browser console.

## Pause, resume, and remove

Use the `tasks` returned by `start()` to retrieve a listener by ID. Call `close()` to pause click logging:

```ts
const task = tasks.get('page-click');
if (task?.kind === 'listener') {
  task.close();
}
```

| Method | Purpose |
| --- | --- |
| `close()` | Pause listening and retain the task |
| `open()` | Resume listening |
| `destroy()` | Remove the listener and task |

`open()` and `close()` return whether the state changed successfully. See [Task Handles](../api/runtime.md#startedtasks) for the full types.

## Control listening with state

Use `activitySignal` when the listener should follow application state. This example toggles click logging with the Escape key:

`src/main.ts`

```ts
import { createActivityStore, createMakoo, listen } from '@makoojs/core';

const enabled = createActivityStore(true);

createMakoo().start([
  listen({
    id: 'page-click',
    listenAt: 'body',
    type: 'click',
    callback: (event) => console.log('Clicked:', event.target),
    activitySignal: () => enabled
  }),
  listen({
    id: 'toggle-clicks',
    listenAt: 'body',
    type: 'keydown',
    callback: (event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        enabled.update((value) => !value);
        console.log('Click listener enabled:', enabled.get());
      }
    }
  })
]);
```

Click logging is enabled when `enabled` is `true` and paused when it is `false`. The object returned by `activitySignal` provides `get()` to read the value and `subscribe()` to observe changes. `createActivityStore()` implements both methods.

The keyboard listener stays enabled, so Escape can resume click logging after it has been paused.

## Attach a listener to a component

A component task’s `options.on` accepts a `listen()` declaration, registering and releasing it with the component task. Inside the component, use `makoo.controlListener('OPEN')` or `makoo.controlListener('CLOSE')` to control it. See [MakooContext](../api/adapters.md#makoocontext).
