import process from 'node:process';
import type { InjectorConfig, MonkeyBuildConfig, MonkeyConfig, MonkeyServerConfig } from './types';

// collect all dependencies
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
// esm
export const ESM_IMPORT_RE =
	/\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
// cjs
export const CJS_IMPORT_RE = /\brequire\s*\(['"]([^'"]+)['"]\)/g;

// plugin
export const VIRTUAL_MODULE_ID = 'virtual:makoo/entry';
export const RESOLVED_ID = '\0virtual:makoo/entry';

export const FAKE_ENTRY = 'makoo-entry.ts';
export const FAKE_RESOLVED_ID = '\0makoo-entry.ts';

// adapter extname
export const REACT_EXTENSIONS = new Set(['.tsx', '.jsx']);
export const VUE_EXTENSIONS = new Set(['.vue']);

// default path
export const DEFAULT_SOURCE_DIR = 'injections';

// The fixed filename (without extension) used for both:
//   - the top-level manifest  (injections/manifest.ts)
//   - the per-module override (injections/foo/manifest.ts)
// Not user-configurable; centralised here so both load paths share one source of truth.
export const DEFAULT_MANIFEST_FILE_NAME = 'manifest';

// default source config
export const DEFAULT_SOURCE_CONFIG = {
	dir: DEFAULT_SOURCE_DIR,
	// '*' matches any single path segment (bare directory name).
	// '**/*' would require a '/' and never match top-level folder names via picomatch.
	include: ['*'],
	exclude: [] as string[],
	manifest: DEFAULT_MANIFEST_FILE_NAME
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
