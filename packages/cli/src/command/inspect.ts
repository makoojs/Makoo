import type { ResolvedConfig } from '../config/types';
import { scanner } from '../scanner/scanner';
import type { ScannerResult } from '../scanner/types';
import { loadMakooConfig } from './_util';

export async function inspectCommand() {
	const resolveViteMakooConfig: ResolvedConfig = await loadMakooConfig();
	const resolveManifest: ScannerResult = await scanner(resolveViteMakooConfig);

	console.log('resolveViteMakooConfig:', resolveViteMakooConfig);
	console.log('resolveManifest:', resolveManifest);
}
