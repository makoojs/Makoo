import type { Plugin } from 'vue';

class _VuePlugin {
	private plugins: Plugin[] = [];

	public getPlugins(): Plugin[] {
		return [...this.plugins];
	}

	public use<T extends Plugin>(plugin: T): void {
		if (this.plugins.includes(plugin)) {
			return;
		}

		this.plugins.push(plugin);
	}

	public usePlugins(...plugins: Plugin[]): void {
		for (const plugin of plugins) {
			this.use(plugin);
		}
	}

	public clear(): void {
		this.plugins = [];
	}
}

export const VuePlugin = new _VuePlugin();
