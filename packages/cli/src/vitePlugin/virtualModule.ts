import { generate } from '../generator/generator';
import type { GeneratorResult } from '../generator/types';
import type { ScannerResult } from '../scanner/types';

export function buildVirtualMouduleCode(scanResult: ScannerResult, isDev: boolean): string {
	const generatorResult: GeneratorResult = generate(scanResult);
	const baseCode: string = generatorResult.code;

	if (!isDev) return baseCode;

	const hmrCode: string = `
    if(import.meta.hot){
      import.meta.hot.on('makoo:structural-hmr', (payload)=>{
        console.info(
          '%c[makoo]%c structural HMR%c ' + payload.reason + '%c ' + payload.file,
          'color:#00d8ff;font-weight:bold',
          'color:#42b883;font-weight:bold',
          'color:#38bdf8',
          'color:#8b949e'
        );
      });
      import.meta.hot.dispose(()=>{
        ${generatorResult.instanceName}.destroyAll()
      });
      import.meta.hot.accept();
    }
  `;

	return `${baseCode} \n ${hmrCode}`;
}
