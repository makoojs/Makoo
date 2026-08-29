import type { MonkeyOption } from 'vite-plugin-monkey';
import type { MonkeyUserscriptOption, ResolvedConfig } from '../config/types';

const normalizeMonkeyLocaleValue = <T>(value: T): T | Record<string, string> =>
	typeof value === 'string' ? { '': value } : value;

const normalizeMonkeyUserscript = (userscript: MonkeyUserscriptOption): MonkeyUserscriptOption =>
	({
		...userscript,
		name: normalizeMonkeyLocaleValue(userscript.name),
		description: normalizeMonkeyLocaleValue(userscript.description)
	}) as MonkeyUserscriptOption;

export function resolveMonkeyPluginOptions(config: ResolvedConfig): MonkeyOption {
	return {
		...config.monkey,
		entry: config.entry,
		userscript: normalizeMonkeyUserscript(config.monkey.userscript),
		server: { ...config.monkey.server },
		build: { ...config.monkey.build }
	};
}
