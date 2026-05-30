import type { Plugin } from 'vite';
import type { CliConfig, ResolvedConfig } from '../config/type';
export type MakooMonkeyPlugin = Plugin & { __makoo: ResolvedConfig };

export type WatchTargets = {
	files: string[];
	dirs: string[];
};

export type MakooOptions = CliConfig & {
	root?: string;
};
