import process from 'node:process';
import type { MonkeyBuildConfig, MonkeyConfig, ResolvedMonkeyServerConfig } from './types';

export const DEFAULT_MONKEY_SERVER_CONFIG: ResolvedMonkeyServerConfig = {
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

export const DEFAULT_MONKEY_CONFIG: Required<Pick<MonkeyConfig, 'align' | 'styleImport'>> = {
	align: 2,
	styleImport: true
};

export const DEFAULT_FILE_NAME_SUFFIX = '.user.js';
