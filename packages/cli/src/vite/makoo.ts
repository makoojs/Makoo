import type { Plugin } from 'vite';
import monkey from 'vite-plugin-monkey';
import { resolveConfig, resolveMonkeyPluginOptions } from '../config/resolve';
import type { MakooConfig } from '../config/types';

/**
 * Creates the Vite plugins that build the userscript and serve its dev install entry.
 */
export function makoo(options: MakooConfig): Plugin[] {
	const { root, ...config } = options;
	const resolvedConfig = resolveConfig(config, root);
	const monkeyOptions = resolveMonkeyPluginOptions(resolvedConfig);
	return monkey(monkeyOptions);
}
