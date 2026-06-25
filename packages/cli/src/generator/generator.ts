import type { ScannerResult } from '../scanner/types';
import { renderImportAdapter } from './render/import/importAdapter';
import { renderImportComp } from './render/import/importComp';
import { renderImportMakooRuntime } from './render/import/importMakooRuntime';
import { renderRuntimeSetupImport } from './render/import/importRuntimeSetup';
import { renderInitMakooRuntime } from './render/init/initMakooRuntime';
import { renderRegisterComponent } from './render/init/registerComp';
import { renderMakooStart } from './render/run/renderMakooStart';
import type {
	GeneratorResult,
	RenderImportCompResult,
	RenderImportResult,
	RenderInitResult
} from './types';

export function generate(sannerResult: ScannerResult): GeneratorResult {
	const importRuntimeSetup = renderRuntimeSetupImport(sannerResult.config.runtime.setup);
	const importComponent: RenderImportCompResult = renderImportComp(sannerResult.injections);
	const importAdapter: RenderImportResult = renderImportAdapter(sannerResult.injections);
	const initMakooRuntime: RenderInitResult = renderInitMakooRuntime(
		sannerResult.frameworks,
		sannerResult.injectionDefaults
	);
	const initComponetnRegister: RenderInitResult = renderRegisterComponent(
		initMakooRuntime.instanceName,
		importComponent.component
	);

	const importCode: string = [
		importRuntimeSetup,
		importComponent.code,
		renderImportMakooRuntime(),
		importAdapter.code
	]
		.filter(Boolean)
		.join('\n');
	const initMakooRuntimeCode: string = initMakooRuntime.code;
	const registerCode: string = initComponetnRegister.code;
	const makooStartCode: string = renderMakooStart(initMakooRuntime.instanceName);

	const body = [initMakooRuntimeCode, registerCode, makooStartCode].join('\n');
	const guardedBody = [
		'try {',
		...body.split('\n').map((l) => `  ${l}`),
		'} catch (e) {',
		"  console.error('[makoo] Injection startup failed:', e);",
		'  throw e;',
		'}'
	].join('\n');

	return {
		code: [importCode, `let ${initMakooRuntime.instanceName};`, guardedBody].join('\n'),
		instanceName: initMakooRuntime.instanceName
	};
}
