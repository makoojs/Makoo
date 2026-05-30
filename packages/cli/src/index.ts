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
} from './config/type';
export { makoo } from './vitePlugin/makoo';
export type { MakooOptions } from './vitePlugin/type';
