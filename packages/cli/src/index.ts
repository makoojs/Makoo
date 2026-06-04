export { cdn } from 'vite-plugin-monkey';
export {
	defineInjection,
	defineInjections
} from './config/config';
export type {
	AppConfig,
	CliConfig,
	InjectionFramework,
	InjectionManifest,
	InjectionModuleConfig,
	InjectorConfig,
	MonkeyBuildConfig,
	MonkeyConfig,
	MonkeyServerConfig,
	SourceConfig
} from './config/types';
export { makoo } from './vitePlugin/makoo';
export type { MakooOptions } from './vitePlugin/types';
