import type { ResolvedConfig } from '../config/types';
import { scanner } from '../scanner/scanner';
import type { ScannerResult } from '../scanner/types';
import { ansi, colorize, loadMakooConfig } from './_util';
export async function inspectCommand() {
	const resolveViteMakooConfig: ResolvedConfig = await loadMakooConfig();
	const resolveManifest: ScannerResult = await scanner(resolveViteMakooConfig);

	console.log(colorize('Manifest:', ansi.green));
	console.dir(resolveManifest, {
		depth: null,
		colors: true
	});
	console.log(colorize('Vite Makoo Config:', ansi.cyan));
	console.dir(resolveViteMakooConfig, {
		depth: null,
		colors: true
	});
}
