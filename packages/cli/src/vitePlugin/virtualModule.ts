import { generate } from 'src/generator/generator';
import type { GeneratorResult } from 'src/generator/type';
import type { ScannerResult } from 'src/scanner/type';

export const VIRTUAL_MODULE_ID = 'virtual:rite/entry';
export const RESOLVED_ID = '\0virtual:rite/entry';

export function buildVirtualMouduleCode(scanResult: ScannerResult, isDev: boolean): string {
	const generatorResult: GeneratorResult = generate(scanResult);
	const baseCode: string = generatorResult.code;

	if (!isDev) return baseCode;

	const hmrCode: string = `
    if(import.meta.hot){
      import.meta.hot.dispose(()=>{
        ${generatorResult.instanceName}.destroyAll()
      });
      import.meta.hot.accept();
    }
  `;

	return `${baseCode} \n ${hmrCode}`;
}
