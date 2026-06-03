import type { Plugin } from 'vite';
import monkey from 'vite-plugin-monkey';
import { resolveConfig, resolveMonkeyPluginOptions } from '../config/resolve';
import { makooMonkey } from './makooMonkey';
import type { MakooOptions } from './types';

export function makoo(options: MakooOptions): Plugin[] {
	const resolvedConfig = resolveConfig(options, options.root);
	const monkeyOptions = resolveMonkeyPluginOptions(resolvedConfig, options.monkey);

	return [makooMonkey(resolvedConfig), ...monkey(monkeyOptions)];
}
