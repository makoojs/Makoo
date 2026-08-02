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

export type InjectionManifestBindings = {
	hooks?: ManifestBinding;
	on?: {
		callback: ManifestBinding;
		activitySignal?: ManifestBinding;
	};
};

export type ListenerManifestBindings = {
	callback: ManifestBinding;
	activitySignal?: ManifestBinding;
};

export type ScannerManifestBindings = {
	injectionDefaults?: {
		hooks: ManifestBinding;
	};
	injections: Record<string, InjectionManifestBindings>;
	listeners: Record<string, ListenerManifestBindings>;
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
