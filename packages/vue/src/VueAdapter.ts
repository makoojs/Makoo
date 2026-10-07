import { MakooAggregateError, MakooError, MakooErrorCode, type MountAdapter } from '@makoojs/core';
import { type App, type Component, createApp } from 'vue';
import { componentContextKey } from './composables';
import { VueErrorCode } from './error';
import { VuePlugin } from './VuePlugin';

export type VueMountHandle = App<Element>;
export type VueMountComponent = Component;
/** Root props passed to the component as-is; reactive values keep Vue reactivity. */
export type VueMountProps = Record<string, unknown>;

export type VueMountAdapter = MountAdapter<VueMountComponent, VueMountProps, VueMountHandle>;

export function createVueAdapter(): VueMountAdapter {
	return {
		name: 'vue',
		mount({ component, props, command, status, container, globalListener }) {
			const subscriptions = new Set<() => void>();
			let hasMountStarted = false;
			try {
				const app = createApp(component, props ?? null);
				app.provide(componentContextKey, {
					command,
					status,
					globalListener,
					subscriptions
				});
				for (const plugin of VuePlugin.getPlugins()) {
					app.use(plugin);
				}
				hasMountStarted = true;
				app.mount(container);
				return app;
			} catch (cause) {
				const cleanupErrors = releaseSubscriptions(subscriptions);
				if (hasMountStarted) {
					// app.unmount() cannot clean a tree that failed during mount.
					cleanupErrors.push(
						new MakooError(
							'Cannot confirm Vue component cleanup after mount failed; reload the page',
							{ code: VueErrorCode.VUE_PARTIAL_MOUNT_UNCONFIRMED }
						)
					);
				}
				if (cleanupErrors.length === 0) throw cause;
				throw new MakooAggregateError(
					cleanupErrors,
					'Failed to clean up after the Vue mount failed',
					{ code: MakooErrorCode.MOUNT_CLEANUP_FAILED, cause }
				);
			}
		},
		unmount(app) {
			app.unmount();
		}
	};
}

function releaseSubscriptions(subscriptions: Set<() => void>): unknown[] {
	const errors: unknown[] = [];
	for (const release of [...subscriptions]) {
		try {
			release();
		} catch (cause) {
			errors.push(cause);
		}
	}
	return errors;
}
