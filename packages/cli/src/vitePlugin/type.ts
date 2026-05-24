import type { CliConfig } from 'src/config/type';

export type WatchTargets = {
	files: string[];
	dirs: string[];
};

export type MakooMonkeyOptions = CliConfig & {
	root?: string;
};
