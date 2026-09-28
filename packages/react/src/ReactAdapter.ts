import { ErrorCode, type MountAdapter } from '@makoojs/core';
import { type ComponentType, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { causeError, ReactAdapterError } from './error';
import { MakooComponentContext } from './hooks';

// biome-ignore lint/suspicious/noExplicitAny: accepts components with any props shape
export type ReactMountComponent = ComponentType<any>;
export type ReactMountProps = Record<string, unknown>;
export type ReactMountRoot = Root;

export type ReactMountAdapter = MountAdapter<ReactMountComponent, ReactMountProps, ReactMountRoot>;

export function createReactAdapter(): ReactMountAdapter {
	return {
		name: 'react',
		mount({ component, props, control, container }) {
			let root: Root | undefined;
			try {
				root = createRoot(container);
				root.render(
					createElement(
						MakooComponentContext.Provider,
						{ value: control },
						createElement(component, props)
					)
				);
				return root;
			} catch (cause) {
				const error = new ReactAdapterError(
					'Failed to mount React component',
					undefined,
					ErrorCode.ADAPTER_MOUNT_FAIL,
					causeError(cause)
				);
				if (root) {
					try {
						root.unmount();
					} catch (unmountCause) {
						error.withCleanupErrors([unmountError(unmountCause)]);
					}
				}
				throw error;
			}
		},
		unmount(root) {
			try {
				root.unmount();
			} catch (cause) {
				throw unmountError(cause);
			}
		}
	};
}

function unmountError(cause: unknown): ReactAdapterError {
	return new ReactAdapterError(
		'Failed to unmount React component',
		undefined,
		ErrorCode.ADAPTER_UNMOUNT_FAIL,
		causeError(cause)
	);
}
