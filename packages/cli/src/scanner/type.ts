import type {
	InjectionManifest,
	InjectionModuleConfig,
	ResolvedConfig,
	ResolvedInjectionFramework,
	ResolvedInjectionModule
} from '../config/type';

export type ScannerResult = {
	manifestFile: string;
	config: ResolvedConfig;
	injections: ResolvedInjectionModule[];
	frameworks: ResolvedInjectionFramework[];
};

export type LoadManifestResult = {
	manifest: InjectionManifest;
	manifestFile: string;
};

export type LoadMetaResult = {
	overridePath: string;
	moduleConfig: InjectionModuleConfig;
};
