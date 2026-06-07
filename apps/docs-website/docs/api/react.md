# @makoojs/react

`@makoojs/react` provides the React adapter that lets Makoo mount React components in injection tasks.

## Exports

```ts
import { createReactAdapter, ReactAdapterError } from '@makoojs/react';
```

Types:

```ts
import type {
	ReactMountAdapter,
	ReactMountArtifact,
	ReactMountProps,
	ReactMountRoot
} from '@makoojs/react';
```

## createReactAdapter()

Creates the React mount adapter.

```ts
import { Injector } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Panel from './Panel';

const injector = new Injector();

injector.applyAdapter(createReactAdapter());
injector.register('body', Panel);
injector.run();
```

Signature:

```ts
function createReactAdapter(): ReactMountAdapter;
```

The adapter:

1. Checks whether an artifact is a mountable React component.
2. Creates a React root with `createRoot(mountPoint)`.
3. Renders with `root.render(createElement(artifact, { makoo }))`.
4. Calls `root.unmount()` on reset, destroy, or remount.

## Component Props

React components receive a `makoo` prop:

```tsx
import type { ReactMountProps } from '@makoojs/react';

export function Panel({ makoo }: ReactMountProps) {
	return (
		<button onClick={() => makoo.destroy()}>
			Close
		</button>
	);
}
```

Type:

```ts
type ReactMountProps = {
	makoo: MakooContext;
};
```

`MakooContext` comes from `@makoojs/core` and contains task id, target selector, reset/destroy methods, hooks, logger access, and listener controls.

## ReactMountArtifact

The React adapter supports regular function components and React exotic components:

```ts
type ReactMountArtifact = ComponentType<ReactMountProps> | ExoticComponent<ReactMountProps>;
```

For example:

```tsx
function Toolbar(props: ReactMountProps) {
	return <div />;
}

const MemoToolbar = memo(Toolbar);

injector.register('#toolbar', Toolbar);
injector.register('#toolbar', MemoToolbar);
```

## ReactMountAdapter

```ts
type ReactMountAdapter = ResolvableMountAdapter<
	ReactMountArtifact,
	ReactMountRoot,
	undefined
>;
```

`ReactMountRoot` is the `Root` type from `react-dom/client`.

Most projects do not need to use this type directly unless they are composing or testing adapters.

## Usage in Manifest

When using React components through `@makoojs/cli`, set `framework: 'React'` explicitly:

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.jsx',
			framework: 'React'
		}
	}
});
```

Makoo can infer React from `.jsx` and `.tsx` files, but being explicit keeps the manifest easier to read.

## ReactAdapterError

The React adapter throws `ReactAdapterError` when mount or unmount fails.

```ts
import { ReactAdapterError } from '@makoojs/react';

try {
	injector.run();
} catch (error) {
	if (error instanceof ReactAdapterError) {
		console.error(error.code, error.issues);
	}
}
```

`ReactAdapterError` extends `AdapterError`, so it can also be handled through the base error types from `@makoojs/core`.

## Notes

The React adapter calls `createRoot()` on the `mountPoint` provided by Makoo. For floating tools, registering directly on `body` can conflict with host pages that already use React or complex DOM runtimes. In production projects, prefer creating a dedicated child host node and mounting the component into that node.
