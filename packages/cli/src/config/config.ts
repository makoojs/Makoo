import type { InjectionManifest, InjectionModuleConfig, StrictShape } from './types';

export const defineInjection = <T extends InjectionModuleConfig>(
	config: StrictShape<InjectionModuleConfig, T>
): T => config;

export function defineInjections<T extends InjectionManifest>(
	manifest: StrictShape<InjectionManifest, T>
): T {
	return manifest;
}
