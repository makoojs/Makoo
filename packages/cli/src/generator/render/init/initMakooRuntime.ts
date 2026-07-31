import type { ResolvedInjectionDefaults } from '../../../config/types';
import { ManifestBindingNotFoundError } from '../../../error/MakooCliError';
import type { ScannerManifestBindings } from '../../../scanner/types';
import type { RenderInitResult, RenderManifestReference } from '../../types';
import { renderInlineValue } from '../util/value';

export function renderInitMakooRuntime(
	frameworks: string[],
	injectionDefaults: ResolvedInjectionDefaults,
	manifestBinding: ScannerManifestBindings['injectionDefaults'],
	renderManifestReference: RenderManifestReference
): RenderInitResult {
	const instanceName: string = 'makoo';
	const { hooks, ...defaults } = injectionDefaults;
	const adapterEntries = frameworks.map((framework) => `create${framework}Adapter()`);
	let hooksReference: string | undefined;
	if (hooks) {
		if (!manifestBinding) {
			throw new ManifestBindingNotFoundError('injectionDefaults', 'hooks');
		}
		hooksReference = renderManifestReference(manifestBinding.hooks);
	}
	const createOptions = [
		`defaults: ${renderInlineValue(defaults)}`,
		adapterEntries.length > 0 ? `adapters: [${adapterEntries.join(', ')}]` : null,
		hooksReference ? `hooks: ${hooksReference}` : null
	].filter(Boolean);
	const initMakooRuntime: string = `${instanceName} = createMakoo({\n  ${createOptions.join(',\n  ')}\n});`;
	const initTasks = `const ${instanceName}Tasks = [];`;
	return {
		code: [initMakooRuntime, initTasks].join('\n'),
		instanceName
	};
}
