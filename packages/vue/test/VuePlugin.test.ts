import { afterEach, describe, expect, it } from 'vitest';
import { VuePlugin } from '../src/VuePlugin';

describe('VuePlugin', () => {
	afterEach(() => {
		VuePlugin.clear();
	});

	it('deduplicates plugins registered multiple times', () => {
		const plugin = { install() {} };

		VuePlugin.use(plugin);
		VuePlugin.use(plugin);
		VuePlugin.usePlugins(plugin);

		expect(VuePlugin.getPlugins()).toEqual([plugin]);
	});

	it('clears registered plugins', () => {
		const pluginA = { install() {} };
		const pluginB = { install() {} };

		VuePlugin.usePlugins(pluginA, pluginB);
		expect(VuePlugin.getPlugins()).toEqual([pluginA, pluginB]);

		VuePlugin.clear();

		expect(VuePlugin.getPlugins()).toEqual([]);
	});
});
