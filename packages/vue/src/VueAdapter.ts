import { ErrorCode } from '@makoo/core';
import type { ComponentPublicInstance } from 'vue';
import { createApp } from 'vue';
import { VueAdapterError } from './error';
import type { VueMountAdapter } from './type';
import { isVueComponent } from './util';
import { VuePlugin } from './VuePlugin';

export function createVueAdapter(): VueMountAdapter {
	const adapter: VueMountAdapter = {
		name: 'vue',
		matches: isVueComponent,
		mount({ mountPoint, artifact }) {
			try {
				const app = createApp(artifact);
				const plugins = VuePlugin.getPlugins();
				for (const plugin of plugins) {
					app.use(plugin);
				}
				const instance = app.mount(mountPoint) as ComponentPublicInstance;
				return {
					handle: app,
					instance
				};
			} catch (cause) {
				throw new VueAdapterError(
					`Failed to mount Vue component at "${mountPoint}"`,
					[
						{
							path: '(mount)',
							message: cause instanceof Error ? cause.message : String(cause)
						}
					],
					ErrorCode.VUE_MOUNT_FAIL,
					cause instanceof Error ? cause : undefined
				);
			}
		},
		unmount({ handle }) {
			try {
				handle.unmount();
			} catch (cause) {
				throw new VueAdapterError(
					'Failed to unmount Vue component',
					[
						{
							path: '(unmount)',
							message: cause instanceof Error ? cause.message : String(cause)
						}
					],
					ErrorCode.VUE_UNMOUNT_FAIL,
					cause instanceof Error ? cause : undefined
				);
			}
		}
	};

	return adapter;
}
