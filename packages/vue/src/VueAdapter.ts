import { ErrorCode, type MakooError, type MountAdapter } from '@makoojs/core';
import { type App, type Component, createApp } from 'vue';
import { componentContextKey } from './composables';
import { causeError, VueAdapterError } from './error';
import { VuePlugin } from './VuePlugin';

export type VueMountHandle = App<Element>;
export type VueMountComponent = Component;
/** Root props passed to the component as-is; reactive values keep Vue reactivity. */
export type VueMountProps = Record<string, unknown>;

export type VueMountAdapter = MountAdapter<VueMountComponent, VueMountProps, VueMountHandle>;

export function createVueAdapter(): VueMountAdapter {
	return {
		name: 'vue',
		mount({ component, props, command, status, container }) {
			const subscriptions = new Set<() => void>();
			let hasMountStarted = false;
			try {
				const app = createApp(component, props ?? null);
				app.provide(componentContextKey, { command, status, subscriptions });
				for (const plugin of VuePlugin.getPlugins()) {
					app.use(plugin);
				}
				hasMountStarted = true;
				app.mount(container);
				return app;
			} catch (cause) {
				const cleanupErrors = releaseSubscriptions(subscriptions);
				if (hasMountStarted) {
					// Vue cannot unmount a partially mounted tree through app.unmount().
					cleanupErrors.push(
						new VueAdapterError(
							'Cannot confirm Vue component cleanup after mount failed; reload the page',
							undefined,
							ErrorCode.ADAPTER_UNMOUNT_FAIL,
							causeError(cause)
						)
					);
				}
				throw new VueAdapterError(
					'Failed to mount Vue component',
					undefined,
					ErrorCode.ADAPTER_MOUNT_FAIL,
					causeError(cause)
				).withCleanupErrors(cleanupErrors);
			}
		},
		unmount(app) {
			try {
				app.unmount();
			} catch (cause) {
				throw new VueAdapterError(
					'Failed to unmount Vue component',
					undefined,
					ErrorCode.ADAPTER_UNMOUNT_FAIL,
					causeError(cause)
				);
			}
		}
	};
}

function releaseSubscriptions(subscriptions: Set<() => void>): MakooError[] {
	const errors: MakooError[] = [];
	for (const release of [...subscriptions]) {
		try {
			release();
		} catch (cause) {
			errors.push(
				new VueAdapterError(
					'Failed to release a Vue state subscription',
					undefined,
					ErrorCode.ADAPTER_UNMOUNT_FAIL,
					causeError(cause)
				)
			);
		}
	}
	return errors;
}
