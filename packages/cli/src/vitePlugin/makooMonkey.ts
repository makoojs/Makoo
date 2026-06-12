import path from 'node:path';
import type { ConfigEnv, ViteDevServer } from 'vite';
import { FAKE_ENTRY, FAKE_RESOLVED_ID, RESOLVED_ID, VIRTUAL_MODULE_ID } from '../config/defaults';
import type { ResolvedConfig } from '../config/types';
import { scanner } from '../scanner/scanner';
import type { ScannerResult } from '../scanner/types';
import { ansi, colorize } from '../shared/terminalColor';
import {
	invalidateVirtualModule,
	sendScanError,
	sendStructuralHmr,
	triggerModuleHmr
} from './hmrController';
import type { MakooMonkeyPlugin } from './types';
import { buildVirtualMouduleCode } from './virtualModule';
import { classifyStructuralChange, getWatchTargets, isStructuralChange } from './watchList';

export function makooMonkey(config: ResolvedConfig): MakooMonkeyPlugin {
	let scanResult: ScannerResult | null = null;
	let isDev: boolean = false;
	let devServer: ViteDevServer | null = null;
	let scanning: Promise<boolean> | null = null;

	async function rescan(): Promise<boolean> {
		if (!scanning) {
			scanning = scanner(config)
				.then((result) => {
					scanResult = result;
					return true;
				})
				.catch((err) => {
					if (devServer) sendScanError(devServer, err);
					else console.error('[makoo]', err);
					return false;
				})
				.finally(() => {
					scanning = null;
				});
		}
		return scanning;
	}

	function syncWatchTargets(server: ViteDevServer): void {
		if (!scanResult) return;
		const { files, dirs } = getWatchTargets(scanResult);

		for (const f of files) {
			server.watcher.add(f);
		}
		for (const d of dirs) {
			server.watcher.add(d);
		}
	}

	return {
		name: 'vite-plugin-makoo',
		__makoo: config,
		enforce: 'pre',
		config(_, env: ConfigEnv) {
			isDev = env.command === 'serve';
		},
		async buildStart() {
			await rescan();
		},
		resolveId(id: string) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_ID;
			}
			if (id === FAKE_ENTRY || id === `./${FAKE_ENTRY}` || id === `/${FAKE_ENTRY}`) {
				return FAKE_RESOLVED_ID;
			}
		},
		load(id: string) {
			if (id !== RESOLVED_ID && id !== FAKE_RESOLVED_ID) return;
			if (!scanResult) return 'export {}';
			return buildVirtualMouduleCode(scanResult, isDev);
		},
		async configureServer(server: ViteDevServer) {
			devServer = server;
			const ok = await rescan();
			if (ok) syncWatchTargets(server);

			const onChange = async (changedFile: string) => {
				if (!scanResult) return;
				if (!isStructuralChange(changedFile, scanResult)) return;
				const reason = classifyStructuralChange(changedFile, scanResult);
				if (!reason) return;

				const ok = await rescan();
				if (!ok) return;

				const relativeFile = path.relative(config.root, changedFile);
				server.config.logger.info(
					`[makoo] ${colorize('structural HMR', ansi.green)} ${colorize(reason, ansi.cyan)}: ${colorize(relativeFile, ansi.dim)}`
				);
				syncWatchTargets(server);
				invalidateVirtualModule(server);
				sendStructuralHmr(server, {
					file: changedFile,
					reason,
					timestamp: Date.now()
				});
				triggerModuleHmr(server);
			};
			server.watcher.on('change', onChange);
			server.watcher.on('add', onChange);
			server.watcher.on('remove', onChange);
			server.watcher.on('unlink', onChange);
			server.watcher.on('addDir', onChange);
			server.watcher.on('unlinkDir', onChange);
		},
		handleHotUpdate({ file, modules }) {
			if (!scanResult) return;
			if (isStructuralChange(file, scanResult)) {
				return [];
			}
			return modules;
		}
	};
}
