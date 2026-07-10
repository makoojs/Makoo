import type {
	InjectionManifest,
	InjectionModuleConfig,
	ResolvedConfig,
	ResolvedInjectionDefaults,
	ResolvedInjectionFramework,
	ResolvedInjectionModule,
	ResolvedListener
} from '../config/types';

export type ScannerResult = {
	manifestFile: string;
	manifestDependencies: string[];
	moduleManifestDependencies: string[];
	runtimeSetupFiles: string[];
	runtimeDependencies: string[];
	config: ResolvedConfig;
	injectionDefaults: ResolvedInjectionDefaults;
	injections: ResolvedInjectionModule[];
	listeners: ResolvedListener[];
	frameworks: ResolvedInjectionFramework[];
};

export type LoadManifestResult = {
	manifest: InjectionManifest;
	manifestFile: string;
	dependencies: string[];
};

export type LoadMetaResult = {
	moduleManifestFile: string;
	moduleConfig: InjectionModuleConfig;
	dependencies: string[];
};

export type CollectDependenciesOption = {
	root: string;
	includeEntry?: boolean;
};
