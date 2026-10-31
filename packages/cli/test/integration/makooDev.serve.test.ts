import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { ViteDevServer } from 'vite';
import { createServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDevBridge } from '../../src/bridge/server';
import { devCommand } from '../../src/commands/dev';
import type { RuntimeSource } from '../../src/tui/DevTerminal';
import { DevTerminal } from '../../src/tui/DevTerminal';
import { createMakooDev, makooDev } from '../../src/vite/makooDev';
import { bridgeReachable } from '../utils/bridge';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

let server: ViteDevServer | undefined;

function fakeTerminalDeps(port: number) {
	const terminals: { server: ViteDevServer; store: RuntimeSource }[] = [];
	const terminal = {
		showHome: vi.fn(async () => {}),
		activate: vi.fn(),
		close: vi.fn()
	};
	const deps = {
		address: { host: '127.0.0.1', port },
		runtimeFile: resolve(import.meta.dirname, '../../src/bridge/runtime.ts'),
		startBridge: vi.fn(startDevBridge),
		createTerminal: vi.fn(async (server: ViteDevServer, store: RuntimeSource) => {
			terminals.push({ server, store });
			return terminal as unknown as DevTerminal;
		}),
		resolveDevframeClient: () => createRequire(import.meta.url).resolve('devframe/client')
	};
	return { deps, terminal, terminals };
}

afterEach(async () => {
	await server?.close();
	server = undefined;
	vi.restoreAllMocks();
	await cleanupTempProjects();
});

describe('makooDev terminal lifecycle', () => {
	it('stays fully off in middleware mode', async () => {
		const { deps } = fakeTerminalDeps(18116);
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { middlewareMode: true },
			plugins: [createMakooDev(deps)]
		});

		expect(deps.startBridge).not.toHaveBeenCalled();
		expect(deps.createTerminal).not.toHaveBeenCalled();
		expect(await bridgeReachable(18116)).toBe(false);
	});

	it('does not create a terminal for a programmatic listen', async () => {
		const { deps } = fakeTerminalDeps(18117);
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { host: '127.0.0.1', port: 0 },
			plugins: [createMakooDev(deps)]
		});
		await server.listen();

		await vi.waitFor(async () => expect(await bridgeReachable(18117)).toBe(true));
		expect(deps.createTerminal).not.toHaveBeenCalled();
	});

	it('takes over the terminal when the CLI calls printUrls and bindCLIShortcuts', async () => {
		const { deps, terminal, terminals } = fakeTerminalDeps(18118);
		let facade: ViteDevServer | undefined;
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { host: '127.0.0.1', port: 0 },
			plugins: [
				createMakooDev(deps),
				{
					name: 'capture-facade',
					configureServer(s) {
						facade = s;
					}
				}
			]
		});
		await server.listen();

		// createServer() returns a different object than the one plugins see in
		// configureServer, but calls on it dispatch to the same overrides.
		server.printUrls();
		server.bindCLIShortcuts({ print: true });

		await vi.waitFor(() => {
			expect(terminal.showHome).toHaveBeenCalledOnce();
			expect(terminal.activate).toHaveBeenCalledOnce();
		});
		expect(terminals).toHaveLength(1);
		expect(terminals[0]?.server).toBe(facade);
		expect(terminals[0]?.store.getRuntimeSnapshots()).toEqual([]);
	});

	it('re-takes over automatically after a restart that a CLI once drove', async () => {
		const { deps, terminal, terminals } = fakeTerminalDeps(18119);
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { host: '127.0.0.1', port: 0 },
			plugins: [createMakooDev(deps)]
		});
		await server.listen();
		server.printUrls();
		server.bindCLIShortcuts({ print: true });
		await vi.waitFor(() => expect(deps.createTerminal).toHaveBeenCalledOnce());

		await server.restart();

		await vi.waitFor(() => expect(deps.createTerminal).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => {
			expect(terminal.showHome).toHaveBeenCalledTimes(2);
			expect(terminal.activate).toHaveBeenCalledTimes(2);
		});
		// The plugin-owned store is shared across restarts.
		expect(terminals[1]?.store).toBe(terminals[0]?.store);
		await vi.waitFor(async () => expect(await bridgeReachable(18119)).toBe(true));
	});
});

describe('devCommand serve integration', () => {
	it('serves the supplied project root and keeps serving after a restart', async () => {
		const root = await trackProject({ 'index.html': '<h1>real dev project</h1>' });
		const activate = vi.spyOn(DevTerminal.prototype, 'activate');
		let liveServer: ViteDevServer | undefined;
		vi.stubEnv('CI', 'true');
		try {
			await devCommand({
				root,
				configFile: false,
				logLevel: 'silent',
				server: { host: '127.0.0.1', port: 0, open: false },
				plugins: [
					makooDev(),
					{
						name: 'capture-dev-server',
						configureServer(server) {
							liveServer = server;
						}
					}
				]
			});
			if (!liveServer) throw new Error('devCommand did not create a server');
			const url = liveServer.resolvedUrls?.local[0];
			if (!url) throw new Error('devCommand did not listen');
			expect(await (await fetch(url)).text()).toContain('real dev project');
			await liveServer.restart();
			const restartedUrl = liveServer.resolvedUrls?.local[0];
			if (!restartedUrl) throw new Error('devCommand did not resume listening');
			expect(await (await fetch(restartedUrl)).text()).toContain('real dev project');
			// dev.ts drives the plugin's overrides once; the restart takes over on its own.
			await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(2));
		} finally {
			const terminal = activate.mock.contexts[0];
			if (terminal instanceof DevTerminal) terminal.close();
			await liveServer?.close();
			vi.restoreAllMocks();
			vi.unstubAllEnvs();
			await cleanupTempProjects();
		}
	});
});
