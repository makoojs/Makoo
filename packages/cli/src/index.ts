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
export { makooMonkey } from './vitePlugin/makooMonkeyPlugin';
export { makooPlugin } from './vitePlugin/makooPlugin';
export type { MakooMonkeyOptions } from './vitePlugin/type';
