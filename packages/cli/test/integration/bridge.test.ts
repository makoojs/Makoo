// @vitest-environment node
import net from 'node:net';
import { connectDevframe, type DevframeRpcClient } from 'devframe/client';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDevBridge } from '../../src/bridge/server';
import { RuntimeStore } from '../../src/bridge/store';
import { makooDev } from '../../src/vite/makooDev';
import type { InjectionSnapshot } from '../../src/vite/session';

(globalThis as Record<string, unknown>).location ??= new URL('http://127.0.0.1/');

const PANEL: InjectionSnapshot = {
	name: 'panel',
	kind: 'component',
	status: 'mounted',
	attachedListeners: [{ name: 'hover', status: 'bound' }]
};

function pageClient(port: number, token?: string) {
	return connectDevframe({
		connection: {
			connectionMeta: { backend: 'websocket', websocket: `ws://127.0.0.1:${port}/__ws` },
			metaBaseUrl: `http://127.0.0.1:${port}/`,
			authToken: token
		},
		simpleAuth: false,
		webmcp: false
	});
}

async function bridgeReachable(port: number): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${port}/__connection.json`, {
			signal: AbortSignal.timeout(1000)
		});
		return response.ok;
	} catch {
		return false;
	}
}

// devframe persists the first token it sees process-wide under __DEVFRAME_*
// globals; stash and clear them so a client genuinely presents no credential.
function stashDevframeGlobals(): () => void {
	const stashed = new Map<string, unknown>();
	for (const key of Object.keys(globalThis)) {
		if (key.startsWith('__DEVFRAME_')) {
			stashed.set(key, (globalThis as Record<string, unknown>)[key]);
			delete (globalThis as Record<string, unknown>)[key];
		}
	}
	return () => {
		for (const [key, value] of stashed) {
			(globalThis as Record<string, unknown>)[key] = value;
		}
	};
}

let client: DevframeRpcClient | undefined;
let server: ViteDevServer | undefined;

afterEach(async () => {
	client?.close?.();
	client = undefined;
	await server?.close();
	server = undefined;
});

describe('startDevBridge', () => {
	it('writes submit-page rows into the store and drops them on disconnect', async () => {
		const store = new RuntimeStore();
		const bridge = await startDevBridge(store, { host: '127.0.0.1', port: 18111 });
		try {
			client = await pageClient(18111, bridge.endpoint.token);
			await vi.waitFor(() => expect(client?.status).toBe('connected'));

			await client.call('makoo:submit-page', [
				{ runtimeId: 1, injections: [PANEL], diagnostics: [] }
			]);
			expect(store.getRuntimeSnapshots()).toEqual([
				{ clientId: 0, runtimeId: 1, injections: [PANEL], diagnostics: [] }
			]);

			client.close?.();
			client = undefined;
			await vi.waitFor(() => expect(store.getRuntimeSnapshots()).toEqual([]));
		} finally {
			await bridge.close();
		}
	});

	it('rejects a client without the token', async () => {
		const store = new RuntimeStore();
		const bridge = await startDevBridge(store, { host: '127.0.0.1', port: 18112 });
		const restore = stashDevframeGlobals();
		try {
			client = await pageClient(18112);
			await expect(client.call('makoo:submit-page', [])).rejects.toThrow();
			expect(store.getRuntimeSnapshots()).toEqual([]);
		} finally {
			restore();
			await bridge.close();
		}
	});
});

describe('makooDev bridge lifecycle', () => {
	it('starts a token-authed bridge during configureServer in middleware mode', async () => {
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { middlewareMode: true },
			plugins: [makooDev({ port: 18113 })]
		});

		await vi.waitFor(async () => expect(await bridgeReachable(18113)).toBe(true));

		// The plugin's bridge enforces the same token auth: an unauthenticated
		// client connects but its RPC calls are refused.
		const restore = stashDevframeGlobals();
		try {
			client = await pageClient(18113);
			await expect(client.call('makoo:submit-page', [])).rejects.toThrow();
		} finally {
			restore();
		}
	});

	it('warns and keeps Vite running when the bridge port is occupied', async () => {
		const blocker = net.createServer().listen(18114, '127.0.0.1');
		await new Promise((resolve) => blocker.once('listening', resolve));
		const warn = vi.fn();
		try {
			server = await createServer({
				configFile: false,
				root: process.cwd(),
				logLevel: 'silent',
				server: { middlewareMode: true },
				plugins: [
					{
						name: 'spy-logger',
						enforce: 'pre',
						configureServer(viteServer) {
							viteServer.config.logger.warn = warn;
						}
					},
					makooDev({ port: 18114 })
				]
			});
			await vi.waitFor(() => expect(warn).toHaveBeenCalled());
			expect(warn.mock.calls.flat().join(' ')).toContain('already in use');
			expect(warn.mock.calls.flat().join(' ')).toContain('makooDev({ port })');
		} finally {
			await new Promise((resolve) => blocker.close(resolve));
		}
	});

	it('rebinds the bridge when an inline-config plugin instance is restarted', async () => {
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { host: '127.0.0.1', port: 0 },
			plugins: [makooDev({ port: 18115 })]
		});
		await server.listen();
		await vi.waitFor(async () => expect(await bridgeReachable(18115)).toBe(true));

		// server.restart() reuses the same plugin object for inline config.
		await server.restart();
		await vi.waitFor(async () => expect(await bridgeReachable(18115)).toBe(true));
	});

	it('releases the port on close so the next server rebinds it', async () => {
		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { middlewareMode: true },
			plugins: [makooDev({ port: 18115 })]
		});
		await vi.waitFor(async () => expect(await bridgeReachable(18115)).toBe(true));
		await server.close();
		server = undefined;

		server = await createServer({
			configFile: false,
			root: process.cwd(),
			logLevel: 'silent',
			server: { middlewareMode: true },
			plugins: [makooDev({ port: 18115 })]
		});
		await vi.waitFor(async () => expect(await bridgeReachable(18115)).toBe(true));
	});
});
