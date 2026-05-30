import { generate } from '../generator/generator';
import type { GeneratorResult } from '../generator/type';
import type { ScannerResult } from '../scanner/type';

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
