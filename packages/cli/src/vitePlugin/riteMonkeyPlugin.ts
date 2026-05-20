import { resolveConfig, resolveMonkeyPluginOptions } from 'src/config/resolve';
import { loadConfig } from 'src/scanner/load/loadConfig';
import type { Plugin, UserConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import ritePlugin from './ritePlugin';
import type { RiteMonkeyOptions } from './type';

export function riteMonkey(options: RiteMonkeyOptions = {}): Plugin {
	return {
		name: 'vite-plugin-rite-monkey',
		enforce: 'pre',
		async config(): Promise<UserConfig> {
			const config = await loadConfig();
			const _resolveConfig = resolveConfig(config.config);
			loadConfig();

			const monkeyOptions = resolveMonkeyPluginOptions(_resolveConfig, options.monkey);

			return {
				plugins: [ritePlugin(), ...monkey(monkeyOptions)]
			};
		}
	};
}
