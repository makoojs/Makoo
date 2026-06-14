import type { ViteDevServer } from 'vite';
import { RESOLVED_ID } from '../config/defaults';
import type { StructuralHmrPayload } from './types';

export function invalidateVirtualModule(server: ViteDevServer): void {
	const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
	if (mod) {
		server.moduleGraph.invalidateModule(mod);
	}
}
export function sendScanError(server: ViteDevServer, error: unknown): void {
	const err = error instanceof Error ? error : new Error(String(error));
	server.hot.send({
		type: 'error',
		err: {
			message: err.message,
			stack: err.stack ?? '',
			id: RESOLVED_ID,
			frame: '',
			plugin: 'vite-plugin-makoo',
			loc: undefined
		}
	});
}

export function triggerModuleHmr(server: ViteDevServer): void {
	const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
	if (!mod) {
		return;
	}
	server.hot.send({
		type: 'update',
		updates: [
			{
				type: 'js-update',
				path: RESOLVED_ID,
				acceptedPath: RESOLVED_ID,
				timestamp: Date.now(),
				explicitImportRequired: false,
				isWithinCircularImport: false
			}
		]
	});
}

export function sendStructuralHmr(server: ViteDevServer, payload: StructuralHmrPayload): void {
	server.hot.send({
		type: 'custom',
		event: 'makoo:structural-hmr',
		data: payload
	});
}
