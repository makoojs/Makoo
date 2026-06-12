import type { Plugin } from 'vite';
import type { CliConfig, ResolvedConfig } from '../config/types';
export type MakooMonkeyPlugin = Plugin & { __makoo: ResolvedConfig };

export type WatchTargets = {
	files: string[];
	dirs: string[];
};

export type MakooOptions = CliConfig & {
	root?: string;
};
export type StructuralChangeKind =
	| 'top-level-manifest'
	| 'manifest-dependency'
	| 'runtime-setup'
	| 'runtime-dependency'
	| 'module-manifest';

export type StructuralHmrPayload = {
	file: string;
	reason: StructuralChangeKind;
	timestamp: number;
};
