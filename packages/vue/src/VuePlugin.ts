import type { Plugin } from 'vue';

class _VuePlugin {
	private plugins: Plugin[] = [];

	/** Returns a copy of the registered plugins, in registration order. */
	public getPlugins(): Plugin[] {
		return [...this.plugins];
	}

	/** Registers a plugin; registering the same plugin again does nothing. */
	public use<T extends Plugin>(plugin: T): void {
		if (this.plugins.includes(plugin)) {
			return;
		}

		this.plugins.push(plugin);
	}

	/** Registers several plugins in order, skipping ones already registered. */
	public usePlugins(...plugins: Plugin[]): void {
		for (const plugin of plugins) {
			this.use(plugin);
		}
	}

	/** Removes every registered plugin. */
	public clear(): void {
		this.plugins = [];
	}
}

/**
 * Vue plugins installed into every app the Vue adapter mounts from now on; apps already
 * mounted are not affected.
 */
export const VuePlugin = new _VuePlugin();
