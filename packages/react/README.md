# @makoo/react

`@makoo/react` is Makoo's React mount adapter. It connects React components to the `@makoo/core` adapter protocol, allowing `Injector` to create React roots after target DOM nodes appear, render components, and unmount them correctly when tasks are destroyed or reset.

Most Makoo projects use this package through `@makoo/cli`: when a manifest module is recognized as React, the CLI imports the React adapter in the generated virtual entry. You only need to call `createReactAdapter()` explicitly when wiring a runtime manually with `@makoo/core`.

## Use Cases

- Inject React components in a Makoo project.
- Let the `@makoo/core` `Injector` recognize and mount React artifacts.
- Register the React adapter manually when using the core runtime directly.
- Read the Makoo task context `makoo` inside React components.

## Installation

```bash
// npm install @makoo/react
// yarn add @makoo/react
pnpm add @makoo/react
```

`@makoo/react` depends on `@makoo/core` and declares `react` and `react-dom` as peer dependencies, so make sure both `react` and `react-dom` are installed before using this package.

## Usage In CLI Projects

In most cases, you only need to declare a React component in the manifest.

```ts
import { defineInjections } from '@makoo/cli';

export default defineInjections({
	injections: {
		badge: {
			injectAt: 'body',
			component: './badge/App.tsx',
			framework: 'React'
		}
	}
});
```

If `framework` is omitted or set to `auto`, Makoo infers React from the `.tsx` / `.jsx` extension.

## Makoo Context In React Components

The React adapter passes `makoo` to the component as props. Components can use it to read the current task ID, target selector, logger, or control the current task lifecycle.

```tsx
import type { ReactMountProps } from '@makoo/react';

export default function Badge({ makoo }: ReactMountProps) {
	return (
		<button
			type="button"
			onClick={() => {
				makoo.getLogger().info(`clicked ${makoo.taskId}`);
			}}
		>
			Makoo Badge
		</button>
	);
}
```

`makoo` comes from `@makoo/core`'s `MakooContext`. Common capabilities include:

| Capability | Description |
| --- | --- |
| `taskId` | Current injection task ID |
| `injectAt` | Target selector for the current task |
| `enableAlive()` / `disableAlive()` | Control alive reinjection for the current task |
| `reset()` / `destroy()` | Reset or destroy the current task |
| `on()` / `onTask()` | Listen to lifecycle observation events |
| `getLogger()` | Get the current injector logger |

## Direct Usage With @makoo/core

If you are not using `@makoo/cli`, register the React adapter manually on `Injector`.

```tsx
import { Injector } from '@makoo/core';
import { createReactAdapter } from '@makoo/react';
import Badge from './Badge';

const injector = new Injector({
	alive: true,
	scope: 'local',
	timeout: 5000
}).applyAdapter(createReactAdapter());

injector.register('#app', Badge);
injector.run();
```

The adapter returned by `createReactAdapter()` will:

- Create a React root with `react-dom/client`'s `createRoot(mountPoint)`.
- Render the component with `root.render(createElement(artifact, { makoo }))`.
- Call `root.unmount()` during unmount.
- Wrap mount/unmount failures as `ReactAdapterError`.

## Type Exports

`@makoo/react` exports these commonly used types:

| Type | Description |
| --- | --- |
| `ReactMountProps` | Props received by the React component, including `makoo` |
| `ReactMountArtifact` | React artifact type recognized by Makoo |
| `ReactMountAdapter` | React adapter type |
| `ReactMountRoot` | React root handle type |

It also exports:

- `createReactAdapter`
- `ReactAdapterError`

The complete API reference will live in a separate documentation site later.

## Relationship With Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoo/react` | React mount adapter |
| `@makoo/core` | Provides `Injector`, the adapter protocol, and Makoo runtime context |
| `@makoo/cli` | Scans manifests, generates the virtual entry, and imports the React adapter when needed |

`@makoo/react` is not a complete runtime by itself. It works with `@makoo/core`'s injection scheduler, or with runtime code generated automatically by `@makoo/cli`.
