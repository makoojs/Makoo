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
	manifestBindings: ScannerManifestBindings;
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

export type ManifestBinding = {
	manifestFile: string;
	valuePath: Array<string | number>;
};

export type ScannerManifestBindings = {
	injectionDefaults?: ManifestBinding;
	injections: Record<string, ManifestBinding>;
	listeners: Record<string, ManifestBinding>;
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
