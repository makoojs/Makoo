import { ErrorCode } from '@makoo/core';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactAdapterError } from './error';
import type { ReactMountAdapter } from './types';
import { isReactMountArtifact } from './util';

export function createReactAdapter(): ReactMountAdapter {
	return {
		name: 'react',
		matches: isReactMountArtifact,
		mount({ mountPoint, artifact, makoo }) {
			try {
				const root = createRoot(mountPoint);
				root.render(createElement(artifact, { makoo }));
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
					ErrorCode.ADAPTER_MOUNT_FAIL,
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
					ErrorCode.ADAPTER_UNMOUNT_FAIL,
					cause instanceof Error ? cause : undefined
				);
			}
		}
	};
}
