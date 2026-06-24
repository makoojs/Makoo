export { cdn } from 'vite-plugin-monkey';
export {
	defineInjection,
	defineInjections
} from './config/config';
export type {
	AppConfig,
	CliConfig,
	InjectionDefaults,
	InjectionFramework,
	InjectionManifest,
	InjectionModuleConfig,
	MonkeyBuildConfig,
	MonkeyConfig,
	MonkeyServerConfig,
	SourceConfig
} from './config/types';
export { makoo } from './vitePlugin/makoo';
export type { MakooOptions } from './vitePlugin/types';
