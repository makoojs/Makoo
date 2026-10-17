# Handle Node Replacement

When a single-page app switches views or re-renders a list, it often removes the entire element your component is mounted on and creates a new one. This page shows how to make components and listeners recover on the new element. For the mechanism, see [Injection Lifecycle](./lifecycle.md#full-reinjection-and-local-recovery).

## Confirm It Is Node Replacement

When "the component is there at first, then disappears after a while":

1. Read the status: `core.statusHandle('toolbar').lastError?.code`.
2. If it is `MAKOO_MOUNT_TARGET_DETACHED`, the mount target left the page, or the component container was removed or moved out of the mount target.
3. If it is `MAKOO_ATTACHED_LISTENER_FAILED`, expand `cause` to see which attached listener's target became invalid.

You can also watch the Elements panel in the developer tools: when an element is replaced, the whole block of nodes flashes and highlights.

## Make the Component Remount

Enable `reinject` in the declaration:

```ts
inject({
  name: 'toolbar',
  injectAt: '#header .actions',
  adapter: 'vue',
  component: Toolbar,
  reinject: true
})
```

After the mount target becomes invalid, Core first fully cleans up the old component and container, the status becomes `waiting`, and then it finds a new mount target by `injectAt` and mounts again.

Remounting creates a new component instance, so the component's internal state (such as Vue's `ref` or React's `useState`) goes back to its initial value. Data that needs to survive remounts should live outside the component, such as a module-level `ref`, a Pinia store, or a `reactive()` object passed as a `props` property.

## Make Listeners Rebind

Attached listeners use their owning component's `reinject` and can't set it in their own declaration (it is rejected with `MAKOO_DECLARATION_INVALID`). Once the component enables `reinject`, when an attached listener's target is replaced, only that listener finds and binds again; the component itself and other listeners stay unchanged:

```ts
inject({
  name: 'player-panel',
  injectAt: 'body',
  adapter: 'react',
  component: PlayerPanel,
  reinject: true,
  listeners: [
    listen({ name: 'video-play', listenAt: 'video', type: 'play', callback: onPlay })
  ]
})
```

During recovery, that listener's status is `waiting`, and the component can use it to show a hint such as "waiting for the player".

Standalone listeners use their own `reinject`:

```ts
listen({ name: 'shortcut', listenAt: '#editor', type: 'keydown', callback: onKey, reinject: true })
```

## When the New Element Takes Too Long

Each new search has its own wait budget (`timeout`, default 15 seconds). After a timeout, the injection fails with `MAKOO_TARGET_WAIT_TIMEOUT` and stops waiting. When an attached listener's recovery times out, the whole component ends with `MAKOO_ATTACHED_LISTENER_FAILED` and is not fully reinjected again.

You run into this when the user switches to a page without the target element and comes back after a while. Makoo doesn't track URL changes, so choose as needed:

- Increase `timeout` to cover the usual time spent away.
- Where you can detect page switches (for example, by listening to the site's own navigation buttons), call `start()` on an injection that is `failed`:

```ts
const status = core.statusHandle('toolbar');
if (status.getSnapshot() === 'failed') core.command('toolbar').start();
```

## Changes That Don't Trigger a Remount

The following changes don't count as invalidation, and the component stays as it is:

- The mount target's text, attributes, or classes change, even if it no longer matches `injectAt`.
- The mount target is moved away and inserted back into the page within the same batch of DOM changes, with the component container still inside it.

If the site just reuses the same element to show different data (for example, a virtual list), Makoo can't notice; refresh based on the data inside the component yourself.

## Reference

- [The `reinject` field](../api/declarations.md#makoocomponentinput)
- [Status values](../api/status.md#status-values)
