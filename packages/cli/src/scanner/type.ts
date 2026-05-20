import type {
	CliConfig,
	InjectionModuleConfig,
	ResolvedConfig,
	ResolvedInjectionFramework,
	ResolvedInjectionModule
} from '../config/type';

export type LoadedConfig = {
	config: CliConfig;
	riteConfigFile: string;
	root: string;
};

export type ScannerResult = {
	riteConfigFile: string;
	config: ResolvedConfig;
	injections: ResolvedInjectionModule[];
	frameworks: ResolvedInjectionFramework[];
};

export type LoadMetaResult = {
	overridePath: string;
	moduleConfig: InjectionModuleConfig;
};
