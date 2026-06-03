import type { InjectionFramework, ResolvedInjectionModule } from '../../../config/types';
import type { RenderImportResult } from '../../types';

export function renderImportAdapter(injections: ResolvedInjectionModule[]): RenderImportResult {
	const frameworkSet: Set<InjectionFramework> = new Set();
	injections.forEach((injection) => {
		frameworkSet.add(injection.framework);
	});

	const adapterImports = Array.from(frameworkSet).map((adapter) => {
		switch (adapter) {
			case 'React':
				return 'import { createReactAdapter } from "@makoo/react";';
			case 'Vue':
				return 'import { createVueAdapter } from "@makoo/vue";';
			default:
				return null;
		}
	});

	return {
		code: adapterImports.filter(Boolean).join('\n'),
		importsName: [...Array.from(frameworkSet)]
	};
}
