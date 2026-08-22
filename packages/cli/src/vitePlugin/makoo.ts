import type { Plugin } from 'vite';
import monkey from 'vite-plugin-monkey';
import { resolveConfig, resolveMonkeyPluginOptions } from '../config/resolve';
import type { MakooOptions } from './types';

export function makoo(options: MakooOptions): Plugin[] {
	const { root, ...config } = options;
	const resolvedConfig = resolveConfig(config, root);
	const monkeyOptions = resolveMonkeyPluginOptions(resolvedConfig);
	return monkey(monkeyOptions);
}
