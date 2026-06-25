import type { ResolvedInjectionDefaults } from '../../../config/types';
import type { RenderInitResult } from '../../types';
import { renderInlineValue } from '../util/value';

export function renderInitMakooRuntime(
	frameworks: string[],
	injectionDefaults: ResolvedInjectionDefaults
): RenderInitResult {
	const instanceName: string = 'makoo';
	const { hooks, ...defaults } = injectionDefaults;
	const adapterEntries = frameworks.map((framework) => `create${framework}Adapter()`);
	const createOptions = [
		`defaults: ${renderInlineValue(defaults)}`,
		adapterEntries.length > 0 ? `adapters: [${adapterEntries.join(', ')}]` : null,
		hooks ? `hooks: ${renderInlineValue(hooks)}` : null
	].filter(Boolean);
	const initMakooRuntime: string = `${instanceName} = createMakoo({\n  ${createOptions.join(',\n  ')}\n});`;
	const initTasks = `const ${instanceName}Tasks = [];`;
	return {
		code: [initMakooRuntime, initTasks].join('\n'),
		instanceName
	};
}
