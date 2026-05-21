import { resolveConfig, resolveMonkeyPluginOptions } from 'src/config/resolve';
import type { Plugin } from 'vite';
import monkey from 'vite-plugin-monkey';
import { ritePlugin } from './ritePlugin';
import type { RiteMonkeyOptions } from './type';

export function riteMonkey(options: RiteMonkeyOptions): Plugin[] {
	const resolvedConfig = resolveConfig(options, options.root);
	const monkeyOptions = resolveMonkeyPluginOptions(resolvedConfig, options.monkey);

	return [ritePlugin(resolvedConfig), ...monkey(monkeyOptions)];
}
