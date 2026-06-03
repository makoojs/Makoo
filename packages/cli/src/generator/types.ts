import type { ResolvedInjectionModule } from '../config/types';

export type RenderImportResult = {
	code: string;
	importsName: string[];
};
export type Component = {
	code: string;
	componentName: string;
	componentMeta: ResolvedInjectionModule;
};
export type RenderImportCompResult = Omit<RenderImportResult, 'importsName'> & {
	component: Component[];
};
export type RenderInitResult = {
	code: string;
	instanceName: string;
};
export type GeneratorResult = {
	code: string;
	instanceName: string;
};
