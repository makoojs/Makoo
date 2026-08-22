# HMR Behavior

Vite and the framework plugins handle updates to components, styles, and task declarations.

Keep runtime cleanup next to the task startup code so a replaced module does not leave duplicate tasks:

```ts
const tasks = makoo.start([...]);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

## Component Updates

`@vitejs/plugin-vue` updates Vue components, `@vitejs/plugin-react` updates React components,
and Vite updates stylesheets.

## When To Restart

Component and application module edits do not require a restart. Restart the dev server for
toolchain and dependency changes such as:

- installing or upgrading dependencies
- changing Vite plugins
- changing `vite-plugin-monkey` server or build integration
- changing dependency resolution or aliases
