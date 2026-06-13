import type {
	InjectionManifest,
	InjectionModuleConfig,
	ResolvedConfig,
	ResolvedInjectionFramework,
	ResolvedInjectionModule,
	ResolvedInjectorConfig
} from '../config/types';

export type ScannerResult = {
	manifestFile: string;
	manifestDependencies: string[];
	runtimeSetupFiles: string[];
	runtimeDependencies: string[];
	config: ResolvedConfig;
	injector: ResolvedInjectorConfig;
	injections: ResolvedInjectionModule[];
	frameworks: ResolvedInjectionFramework[];
};

export type LoadManifestResult = {
	manifest: InjectionManifest;
	manifestFile: string;
	dependencies: string[];
};

export type LoadMetaResult = {
	overridePath: string;
	moduleConfig: InjectionModuleConfig;
	dependencies: string[];
};

export type CollectDependenciesOption = {
	root: string;
	includeEntry?: boolean;
};
