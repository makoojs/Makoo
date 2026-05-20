import { RESOLVED_ID, VIRTUAL_MODULE_ID } from 'src/config/defaults';
import { scanner } from 'src/scanner/scanner';
import type { ScannerResult } from 'src/scanner/type';
import type { ConfigEnv, Plugin, ViteDevServer } from 'vite';
import { invalidateVirtualModule, sendScanError, triggerModuleHmr } from './hmrController';
import { buildVirtualMouduleCode } from './virtualModule';
import { getWatchTargets, isStructuralChange } from './watchList';

export function ritePlugin(): Plugin {
	let scanResult: ScannerResult | null = null;
	let riteConfigFile: string | null = null;
	let isDev: boolean = false;
	let devServer: ViteDevServer | null = null;
	let scanning: Promise<boolean> | null = null;

	async function rescan(): Promise<boolean> {
		if (!scanning) {
			scanning = scanner()
				.then((result) => {
					scanResult = result;
					riteConfigFile = result.riteConfigFile;
					return true;
				})
				.catch((err) => {
					if (devServer) sendScanError(devServer, err);
					else console.error('[rite]', err);
					return false;
				})
				.finally(() => {
					scanning = null;
				});
		}
		return scanning;
	}

	function syncWatchTargets(server: ViteDevServer): void {
		if (!scanResult || !riteConfigFile) return;
		const { files, dirs } = getWatchTargets(scanResult, riteConfigFile);

		for (const f of files) {
			server.watcher.add(f);
		}
		for (const d of dirs) {
			server.watcher.add(d);
		}
	}

	return {
		name: 'vite-plugin-rite',
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
		},
		load(id: string) {
			if (id !== RESOLVED_ID) return;
			if (!scanResult) return 'export {}';
			return buildVirtualMouduleCode(scanResult, isDev);
		},
		async configureServer(server: ViteDevServer) {
			devServer = server;
			const ok = await rescan();
			if (ok) syncWatchTargets(server);

			const onChange = async (changedFile: string) => {
				if (!scanResult || !riteConfigFile) return;
				if (!isStructuralChange(changedFile, scanResult, riteConfigFile)) return;

				const ok = await rescan();
				if (!ok) return;

				syncWatchTargets(server);
				invalidateVirtualModule(server);
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
			if (!scanResult || !riteConfigFile) return;
			if (isStructuralChange(file, scanResult, riteConfigFile)) {
				return [];
			}
			return modules;
		}
	};
}
