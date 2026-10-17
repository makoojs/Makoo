import { MakooAggregateError, MakooErrorCode, type MountAdapter } from '@makoojs/core';
import { type ComponentType, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MakooComponentContext } from './hooks';

/** Any React component; its props come from the declaration's `props`. */
// biome-ignore lint/suspicious/noExplicitAny: accepts components with any props shape
export type ReactMountComponent = ComponentType<any>;
/** Props passed to the root component as-is. */
export type ReactMountProps = Record<string, unknown>;
/** The React root created for one component mount. */
export type ReactMountRoot = Root;

/** The React component adapter, registered under the name `react`. */
export type ReactMountAdapter = MountAdapter<ReactMountComponent, ReactMountProps, ReactMountRoot>;

/**
 * Creates the React component adapter. Each mount renders the component into its own root, where
 * the Makoo hooks such as `useComponentStatus()` are available.
 *
 * @example
 * ```ts
 * makoo.useAdapter(createReactAdapter());
 * ```
 */
export function createReactAdapter(): ReactMountAdapter {
	return {
		name: 'react',
		mount({ component, props, command, statusHandle, container, globalListener }) {
			let root: Root | undefined;
			try {
				root = createRoot(container);
				root.render(
					createElement(
						MakooComponentContext.Provider,
						{ value: { command, statusHandle, globalListener } },
						createElement(component, props)
					)
				);
				return root;
			} catch (cause) {
				if (!root) throw cause;
				try {
					root.unmount();
				} catch (unmountCause) {
					throw new MakooAggregateError(
						[unmountCause],
						'Failed to clean up after the React mount failed',
						{ code: MakooErrorCode.MOUNT_CLEANUP_FAILED, cause }
					);
				}
				throw cause;
			}
		},
		unmount(root) {
			root.unmount();
		}
	};
}
