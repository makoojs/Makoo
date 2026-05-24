import { ErrorCode } from '@makoo/core';
import { createRoot } from 'react-dom/client';
import { ReactAdapterError } from './error';
import type { ReactMountAdapter } from './type';
import { isReactElement } from './util';

export function createReactAdapter(): ReactMountAdapter {
	return {
		name: 'react',
		matches: isReactElement,
		mount({ mountPoint, artifact }) {
			try {
				const root = createRoot(mountPoint);
				root.render(artifact);
				return {
					handle: root
				};
			} catch (cause) {
				throw new ReactAdapterError(
					`Failed to mount React component at "${mountPoint}"`,
					[
						{
							path: '(mount)',
							message: cause instanceof Error ? cause.message : String(cause)
						}
					],
					ErrorCode.REACT_MOUNT_FAIL,
					cause instanceof Error ? cause : undefined
				);
			}
		},
		unmount({ handle }) {
			try {
				handle.unmount();
			} catch (cause) {
				throw new ReactAdapterError(
					'Failed to unmount React component',
					[
						{
							path: '(unmount)',
							message: cause instanceof Error ? cause.message : String(cause)
						}
					],
					ErrorCode.REACT_UNMOUNT_FAIL,
					cause instanceof Error ? cause : undefined
				);
			}
		}
	};
}
