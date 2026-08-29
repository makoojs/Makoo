# @makoojs/react

`@makoojs/react` is Makoo's React mount adapter. It connects React components to the `@makoojs/core` adapter protocol, allowing the Makoo runtime to create React roots after target DOM nodes appear, render components, and unmount them correctly when tasks are destroyed or reset.

## Use Cases

- Inject React components in a Makoo project.
- Let the `@makoojs/core` runtime recognize and mount React artifacts.
- Register the React adapter manually when using the core runtime directly.
- Read the Makoo task context `makoo` inside React components.

## Installation

```bash
# npm install @makoojs/react
# yarn add @makoojs/react
pnpm add @makoojs/react
```

`@makoojs/react` depends on `@makoojs/core` and declares `react` and `react-dom` as peer dependencies, so make sure both `react` and `react-dom` are installed before using this package.

## Makoo Context In React Components

The React adapter passes `makoo` to the component as props. Components can use it to read the current task ID, target selector, logger, or control the current task lifecycle.

```tsx
import type { ReactMountProps } from '@makoojs/react';

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

`makoo` comes from `@makoojs/core`'s `MakooContext`. Common capabilities include:

| Capability | Description |
| --- | --- |
| `taskId` | Current injection task ID |
| `injectAt` | Target selector for the current task |
| `enableAlive()` / `disableAlive()` | Control alive reinjection for the current task |
| `reset()` / `destroy()` | Reset or destroy the current task |
| `on()` / `onTask()` | Listen to lifecycle observation events |
| `getLogger()` | Get the current runtime logger |

## Usage With @makoojs/core

Pass the React adapter to `createMakoo()`, then declare React component tasks with `inject()`.

```tsx
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Badge from './Badge';

const makoo = createMakoo({
	defaults: {
		alive: true,
		scope: 'local',
		timeout: 5000
	},
	adapters: [createReactAdapter()]
});

makoo.start([
	inject({
		id: 'badge',
		injectAt: '#app',
		artifact: Badge
	})
]);
```

The adapter returned by `createReactAdapter()` will:

- Create a React root with `react-dom/client`'s `createRoot(mountPoint)`.
- Render the component with `root.render(createElement(artifact, { makoo }))`.
- Call `root.unmount()` during unmount.
- Wrap mount/unmount failures as `ReactAdapterError`.

## Type Exports

`@makoojs/react` exports these commonly used types:

| Type | Description |
| --- | --- |
| `ReactMountProps` | Props received by the React component, including `makoo` |
| `ReactMountArtifact` | React artifact type recognized by Makoo |
| `ReactMountAdapter` | React adapter type |
| `ReactMountRoot` | React root handle type |

It also exports:

- `createReactAdapter`
- `ReactAdapterError`

See the React API documentation for complete interface details.

## Relationship With Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/react` | React mount adapter |
| `@makoojs/core` | Provides the runtime API, adapter protocol, and Makoo runtime context |
| `@makoojs/cli` | Provides development and build capabilities for Makoo projects |

`@makoojs/react` works with the injection runtime provided by `@makoojs/core`.
