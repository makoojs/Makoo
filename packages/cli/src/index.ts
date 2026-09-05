export { cdn } from 'vite-plugin-monkey';
export type {
	AppConfig,
	CliConfig,
	MakooConfig as MakooOptions,
	MonkeyBuildConfig,
	MonkeyConfig,
	MonkeyServerConfig
} from './config/types';
export { makoo } from './vite/makoo';
export { makooDev } from './vite/makooDev';
