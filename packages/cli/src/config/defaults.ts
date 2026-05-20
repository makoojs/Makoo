import process from 'node:process';
import type { InjectorConfig, MonkeyBuildConfig, MonkeyConfig, MonkeyServerConfig } from './type';

// default path
export const DEFAULT_SOURCE_DIR = 'injections';

// The fixed filename (without extension) used for both:
//   - the top-level manifest  (injections/meta.ts)
//   - the per-module override (injections/foo/meta.ts)
// Not user-configurable; centralised here so both load paths share one source of truth.
export const META_FILE_NAME = 'meta';

// default source config
export const DEFAULT_SOURCE_CONFIG = {
	dir: DEFAULT_SOURCE_DIR,
	// '*' matches any single path segment (bare directory name).
	// '**/*' would require a '/' and never match top-level folder names via picomatch.
	include: ['*'],
	exclude: [] as string[],
	manifest: META_FILE_NAME
};

export const DEFAULT_INJECTOR_CONFIG: Required<InjectorConfig> = {
	alive: false,
	scope: 'local',
	timeout: 5000,
	hooks: {}
};

export const DEFAULT_MONKEY_SERVER_CONFIG: Required<MonkeyServerConfig> = {
	open: process.platform === 'win32' || process.platform === 'darwin',
	prefix: 'server:',
	mountGmApi: false
};

export const DEFAULT_MONKEY_BUILD_CONFIG: Pick<
	Required<MonkeyBuildConfig>,
	'metaFileName' | 'autoGrant'
> = {
	metaFileName: false,
	autoGrant: true
};

export const DEFAULT_MONKEY_CONFIG: Pick<MonkeyConfig, 'align' | 'clientAlias' | 'styleImport'> = {
	align: 2,
	clientAlias: '$',
	styleImport: true
};

export const DEFAULT_FILE_NAME_SUFFIX = '.user.js';
