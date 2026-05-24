import { resolveConfig, resolveMonkeyPluginOptions } from 'src/config/resolve';
import type { Plugin } from 'vite';
import monkey from 'vite-plugin-monkey';
import { makooPlugin } from './makooPlugin';
import type { MakooMonkeyOptions } from './type';

export function makooMonkey(options: MakooMonkeyOptions): Plugin[] {
	const resolvedConfig = resolveConfig(options, options.root);
	const monkeyOptions = resolveMonkeyPluginOptions(resolvedConfig, options.monkey);

	return [makooPlugin(resolvedConfig), ...monkey(monkeyOptions)];
}
