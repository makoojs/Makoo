import type { MonkeyOption } from 'vite-plugin-monkey';

export type WatchTargets = {
	files: string[];
	dirs: string[];
};

export type RiteMonkeyOptions = {
	root?: string;
	monkey?: Partial<MonkeyOption>;
};
