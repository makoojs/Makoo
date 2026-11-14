import { coreErrors, type MountAdapter } from '@makoojs/core';
import { type App, type Component, createApp } from 'vue';
import { componentContextKey } from './composables';
import { vueErrors } from './error';
import { VuePlugin } from './VuePlugin';

/** The Vue app created for one component mount. */
export type VueMountHandle = App<Element>;
/** Any Vue component accepted by `createApp`. */
export type VueMountComponent = Component;
/** Root props passed to the component as-is; reactive values keep Vue reactivity. */
export type VueMountProps = Record<string, unknown>;

/** The Vue component adapter, registered under the name `vue`. */
export type VueMountAdapter = MountAdapter<VueMountComponent, VueMountProps, VueMountHandle>;

/**
 * Creates the Vue component adapter. Each mount creates its own Vue app, installs the plugins
 * registered with {@link VuePlugin}, and makes `useMakooComponent()` available inside it.
 *
 * @example
 * ```ts
 * makoo.useAdapter(createVueAdapter());
 * ```
 */
export function createVueAdapter(): VueMountAdapter {
	return {
		name: 'vue',
		mount({ component, props, injection, container, listener }) {
			const subscriptions = new Set<() => void>();
			let hasMountStarted = false;
			try {
				const app = createApp(component, props ?? null);
				app.provide(componentContextKey, {
					injection,
					listener,
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
						vueErrors.createRecorded('MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED')
					);
				}
				if (cleanupErrors.length === 0) throw cause;
				throw coreErrors.createRecorded(
					'MAKOO_MOUNT_CLEANUP_FAILED',
					{ name: injection.command.name },
					{ cause, errors: cleanupErrors }
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
