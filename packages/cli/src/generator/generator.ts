import type { ScannerResult } from '../scanner/type';
import { renderImportAdapter } from './render/import/importAdapter';
import { renderImportComp } from './render/import/importComp';
import { renderImportInjector } from './render/import/importInjector';
import { renderInitInjector } from './render/init/initInjector';
import { renderRegisterComponent } from './render/init/registerComp';
import { renderInjectorRun } from './render/run/renderInjectorRun';
import type {
	GeneratorResult,
	RenderImportCompResult,
	RenderImportResult,
	RenderInitResult
} from './type';

export function generate(sannerResult: ScannerResult): GeneratorResult {
	const importComponent: RenderImportCompResult = renderImportComp(sannerResult.injections);
	const importAdapter: RenderImportResult = renderImportAdapter(sannerResult.injections);
	const initInjector: RenderInitResult = renderInitInjector(
		sannerResult.frameworks,
		sannerResult.config.injector
	);
	const initComponetnRegister: RenderInitResult = renderRegisterComponent(
		initInjector.instanceName,
		importComponent.component
	);

	const importCode: string = [
		importComponent.code,
		renderImportInjector(),
		importAdapter.code
	].join('\n');
	const initInjectorCode: string = initInjector.code;
	const registerCode: string = initComponetnRegister.code;
	const injectorRunCode: string = renderInjectorRun(initInjector.instanceName);

	const body = [initInjectorCode, registerCode, injectorRunCode].join('\n');
	const guardedBody = [
		'try {',
		...body.split('\n').map((l) => `  ${l}`),
		'} catch (e) {',
		"  console.error('[makoo] Injection startup failed:', e);",
		'  throw e;',
		'}'
	].join('\n');

	return {
		code: [importCode, guardedBody].join('\n'),
		instanceName: initInjector.instanceName
	};
}
