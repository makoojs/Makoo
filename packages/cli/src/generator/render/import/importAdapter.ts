import type { InjectionFramework, ResolvedInjectionModule } from '../../../config/type';
import type { RenderImportResult } from '../../type';

export function renderImportAdapter(injections: ResolvedInjectionModule[]): RenderImportResult {
	const frameworkSet: Set<InjectionFramework> = new Set();
	injections.forEach((injection) => {
		frameworkSet.add(injection.framework);
	});

	const adapterImports = Array.from(frameworkSet).map((adapter) => {
		switch (adapter) {
			case 'React':
				return [
					'import { createReactAdapter } from "@makoo/react";',
					'import { createElement } from "react";'
				].join('\n');
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
