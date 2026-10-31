// @vitest-environment node
// Node, not jsdom: the page module's devframe client uses node's built-in
// WebSocket, which rejects foreign-realm Event objects that jsdom installs.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { ViteDevServer } from 'vite';
import { createServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDevBridge } from '../../src/bridge/server';
import type { DevTerminal, RuntimeSource } from '../../src/tui/DevTerminal';
import { createMakooDev } from '../../src/vite/makooDev';
import { bridgeReachable } from '../utils/bridge';

const BRIDGE_PORT = 18121;

let server: ViteDevServer | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
	vi.restoreAllMocks();
});

describe('makooDev page runtime', () => {
	it('streams page runtime rows through the real bridge and resends after a restart', async () => {
		const terminals: { server: ViteDevServer; store: RuntimeSource }[] = [];
		const terminal = {
			showHome: vi.fn(async () => {}),
			activate: vi.fn(),
			close: vi.fn()
		};
		const plugin = createMakooDev({
			address: { host: '127.0.0.1', port: BRIDGE_PORT },
			runtimeFile: resolve(import.meta.dirname, '../../src/bridge/runtime.ts'),
			startBridge: vi.fn(startDevBridge),
			createTerminal: vi.fn(async (server: ViteDevServer, store: RuntimeSource) => {
				terminals.push({ server, store });
				return terminal as unknown as DevTerminal;
			}),
			resolveDevframeClient: () => createRequire(import.meta.url).resolve('devframe/client')
		});
		server = await createServer({
			configFile: false,
			// Root at the package so the @makoojs/core dep symlink resolves the
			// way a real project's node_modules would provide it.
			root: resolve(import.meta.dirname, '../..'),
			logLevel: 'silent',
			server: { host: '127.0.0.1', port: 0 },
			plugins: [plugin]
		});
		await server.listen();
		// Materialize a terminal so the plugin's private store is reachable.
		server.printUrls();
		await vi.waitFor(() => expect(terminals).toHaveLength(1));
		const store = terminals[0]?.store;
		if (!store) throw new Error('terminal did not capture the store');
		await vi.waitFor(async () => expect(await bridgeReachable(BRIDGE_PORT)).toBe(true));

		// The SSR runner has no window.location; devframe's ws-url resolution reads it.
		const previousLocation = globalThis.location;
		globalThis.location = new URL('http://127.0.0.1/') as unknown as Location;
		try {
			const mod = await server.ssrLoadModule('@makoojs/core');
			const runtimeModule = await server.ssrLoadModule(
				resolve(import.meta.dirname, '../../src/bridge/runtime.ts')
			);

			// Opening a Core instance alone submits the whole table.
			mod.createMakoo();
			await vi.waitFor(
				() => {
					expect(store.getRuntimeSnapshots()).toEqual([
						expect.objectContaining({ runtimeId: 1, injections: [], diagnostics: [] })
					]);
				},
				{ timeout: 10_000 }
			);

			// A restart kills the bridge; the page reporter reconnects and resends.
			await server.restart();
			await vi.waitFor(async () => expect(await bridgeReachable(BRIDGE_PORT)).toBe(true), {
				timeout: 10_000
			});
			await vi.waitFor(
				() => {
					expect(store.getRuntimeSnapshots()).toEqual([
						expect.objectContaining({ runtimeId: 1, injections: [], diagnostics: [] })
					]);
				},
				{ timeout: 10_000 }
			);

			(runtimeModule as { closePageReporters: () => void }).closePageReporters();
		} finally {
			globalThis.location = previousLocation;
		}
	});
});
