import type { ViteDevServer } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import type { DevBridge } from '../../src/bridge/server';
import type { RuntimeStore } from '../../src/bridge/store';
import type { DevTerminal, RuntimeSource } from '../../src/tui/DevTerminal';
import { makoo } from '../../src/vite/makoo';
import { createMakooDev, makooDev } from '../../src/vite/makooDev';

function getHookHandler<T extends (...args: never[]) => unknown>(
	hook: T | { handler: T } | undefined
): T | undefined {
	if (!hook) {
		return undefined;
	}
	if (typeof hook === 'function') {
		return hook;
	}
	return hook.handler;
}

function callHook(plugin: object, name: string, thisArg: object, ...args: unknown[]) {
	const hook = getHookHandler((plugin as Record<string, never>)[name] as never);
	if (!hook) throw new Error(`expected ${name} hook`);
	return (hook as (...a: unknown[]) => unknown).call(thisArg, ...args);
}

function fakeLogger() {
	return {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		warnOnce: vi.fn(),
		clearScreen: vi.fn(),
		hasWarned: false,
		hasErrorLogged: vi.fn(() => false)
	};
}

function fakeServer({ httpServer = true, inlineConfig = {} } = {}) {
	const listeners = new Map<string, () => void>();
	const server = {
		httpServer: httpServer
			? {
					once: vi.fn((event: string, cb: () => void) => listeners.set(event, cb))
				}
			: null,
		printUrls: vi.fn(),
		bindCLIShortcuts: vi.fn(),
		config: { logger: fakeLogger(), inlineConfig }
	} as unknown as ViteDevServer & {
		config: { logger: ReturnType<typeof fakeLogger> };
	};
	return { server, emitListening: () => listeners.get('listening')?.() };
}

function fakeDeps() {
	const terminal = {
		showHome: vi.fn(async () => {}),
		activate: vi.fn(),
		close: vi.fn()
	};
	const bridge: DevBridge = {
		endpoint: { host: '127.0.0.1', port: 18120, token: 't' },
		close: vi.fn(async () => {})
	};
	const stores = new Map<ViteDevServer, RuntimeSource>();
	const deps = {
		address: { host: '127.0.0.1', port: 18120 },
		startBridge: vi.fn(async (_store: RuntimeStore) => bridge),
		createTerminal: vi.fn(async (server: ViteDevServer, store: RuntimeSource) => {
			stores.set(server, store);
			return terminal as unknown as DevTerminal;
		})
	};
	return { deps, terminal, bridge, stores };
}

describe('makooDev', () => {
	it('rejects invalid bridge options at call time', () => {
		expect(() => makooDev({ port: 0 })).toThrow();
		expect(() => makooDev({ port: 65536 })).toThrow();
		expect(() => makooDev({ port: 1.5 })).toThrow();
		expect(() => makooDev({ port: Number.NaN })).toThrow();
		expect(() => makooDev({ host: '' })).toThrow();
		expect(() => makooDev({ host: 'example.com' })).toThrow();
		expect(() => makooDev({ host: '*.example.com' })).toThrow();

		expect(() => makooDev()).not.toThrow();
		expect(() => makooDev({ port: 8080 })).not.toThrow();
		expect(() => makooDev({ host: 'localhost' })).not.toThrow();
		expect(() => makooDev({ host: '::1' })).not.toThrow();
		expect(() => makooDev({ host: '192.168.1.10' })).not.toThrow();
	});

	it('leaves makoo() responsible only for vite-plugin-monkey', () => {
		const plugins = makoo({
			entry: './src/main.ts',
			app: { name: 'plugin-test', version: '0.0.1' },
			monkey: {}
		});

		expect(plugins.some((plugin) => plugin.name === 'monkey:config')).toBe(true);
		expect(plugins.some((plugin) => plugin.name === 'makoo:dev')).toBe(false);
	});

	it('resolves the public Core entry through Vite before returning its virtual module', async () => {
		const plugin = makooDev();
		const resolveId = getHookHandler(plugin.resolveId);
		if (!resolveId) {
			throw new Error('expected resolveId hook');
		}

		const ctx = {
			resolve: vi.fn().mockResolvedValue({ id: '/resolved/@makoojs/core.js' })
		};

		const result = await resolveId.call(ctx as never, '@makoojs/core', '/project/src/main.ts', {
			isEntry: false
		});

		expect(ctx.resolve).toHaveBeenCalledWith(
			'@makoojs/core',
			'/project/src/main.ts',
			expect.objectContaining({ skipSelf: true })
		);
		expect(result).toBe('\0virtual:makoo-dev');
		ctx.resolve.mockClear();
		expect(
			await resolveId.call(ctx as never, 'unrelated-package', undefined, { isEntry: false })
		).toBeNull();
		expect(ctx.resolve).not.toHaveBeenCalled();
		ctx.resolve.mockResolvedValue(null);
		expect(
			await resolveId.call(ctx as never, '@makoojs/core', undefined, { isEntry: false })
		).toBeNull();
	});
});

describe('makooDev terminal takeover', () => {
	it('warns and no-ops when registered a second time', () => {
		const { deps } = fakeDeps();
		const first = createMakooDev(deps);
		const second = createMakooDev(deps);
		const warn = vi.fn();
		const config = { plugins: [first, second], logger: { warn } };
		callHook(first, 'configResolved', {}, config);
		callHook(second, 'configResolved', {}, config);

		expect(warn).toHaveBeenCalledOnce();
		expect(String(warn.mock.calls[0]?.[0])).toContain('more than once');

		const { server, emitListening } = fakeServer();
		const originalPrintUrls = server.printUrls;
		callHook(second, 'configureServer', {}, server);
		expect(server.printUrls).toBe(originalPrintUrls);
		emitListening();
		expect(deps.startBridge).not.toHaveBeenCalled();
	});

	it('takes over printUrls and bindCLIShortcuts only once a CLI drives them', async () => {
		const { deps, terminal } = fakeDeps();
		const plugin = createMakooDev(deps);
		const { server, emitListening } = fakeServer();
		const originalPrintUrls = server.printUrls;
		callHook(plugin, 'configureServer', {}, server);

		expect(server.printUrls).not.toBe(originalPrintUrls);

		// A programmatic listen never touches the terminal.
		emitListening();
		await vi.waitFor(() => expect(deps.startBridge).toHaveBeenCalledOnce());
		expect(deps.createTerminal).not.toHaveBeenCalled();

		server.printUrls();
		await vi.waitFor(() => expect(terminal.showHome).toHaveBeenCalledOnce());
		server.bindCLIShortcuts();
		await vi.waitFor(() => expect(terminal.activate).toHaveBeenCalledOnce());
	});

	it('takes the terminal back over on a restart once a CLI drove it', async () => {
		const { deps, terminal } = fakeDeps();
		const plugin = createMakooDev(deps);
		// A restart keeps the same inlineConfig object.
		const inlineConfig = {};
		const { server: first } = fakeServer({ inlineConfig });
		callHook(plugin, 'configureServer', {}, first);
		first.bindCLIShortcuts();
		await vi.waitFor(() => expect(terminal.activate).toHaveBeenCalledOnce());

		const { server: next, emitListening } = fakeServer({ inlineConfig });
		callHook(plugin, 'configureServer', {}, next);
		emitListening();
		await vi.waitFor(() => expect(deps.createTerminal).toHaveBeenCalledTimes(2));
		expect(deps.createTerminal.mock.calls[1]?.[0]).toBe(next);
		await vi.waitFor(() => {
			expect(terminal.showHome).toHaveBeenCalledOnce();
			expect(terminal.activate).toHaveBeenCalledTimes(2);
		});
	});

	it('does not take over on an unrelated server that never met the CLI', async () => {
		const { deps } = fakeDeps();
		const plugin = createMakooDev(deps);
		const { server: first } = fakeServer();
		callHook(plugin, 'configureServer', {}, first);
		first.bindCLIShortcuts();
		await vi.waitFor(() => expect(deps.createTerminal).toHaveBeenCalledOnce());

		// A second server with its own inlineConfig must not inherit the flag.
		const { server: next, emitListening } = fakeServer();
		callHook(plugin, 'configureServer', {}, next);
		emitListening();
		await vi.waitFor(() => expect(deps.startBridge).toHaveBeenCalledOnce());
		expect(deps.createTerminal).toHaveBeenCalledOnce();
	});

	it('yields with a warning when another plugin replaced the takeover methods', async () => {
		const { deps, terminal } = fakeDeps();
		const plugin = createMakooDev(deps);
		const { server: first } = fakeServer();
		callHook(plugin, 'configureServer', {}, first);
		first.bindCLIShortcuts();
		await vi.waitFor(() => expect(deps.createTerminal).toHaveBeenCalledOnce());

		// A new server instance after a restart: a later plugin claims printUrls.
		const { server: next, emitListening } = fakeServer({
			inlineConfig: first.config.inlineConfig
		});
		const originalBind = next.bindCLIShortcuts;
		callHook(plugin, 'configureServer', {}, next);
		next.printUrls = vi.fn();

		emitListening();
		await vi.waitFor(() => expect(next.config.logger.warn).toHaveBeenCalledOnce());
		// The surviving half of our override is handed back before yielding.
		expect(next.bindCLIShortcuts).toBe(originalBind);
		expect(String(next.config.logger.warn.mock.calls[0]?.[0])).toContain(
			'printUrls/bindCLIShortcuts'
		);
		// The bridge still starts, but the terminal does not re-take over.
		expect(deps.startBridge).toHaveBeenCalledOnce();
		expect(deps.createTerminal).toHaveBeenCalledOnce();
		expect(terminal.showHome).not.toHaveBeenCalled();
		expect(terminal.activate).toHaveBeenCalledOnce();
	});

	it('warns and stays fully off in middleware mode', () => {
		const { deps } = fakeDeps();
		const plugin = createMakooDev(deps);
		const { server } = fakeServer({ httpServer: false });
		const originalPrintUrls = server.printUrls;
		const originalBindCLIShortcuts = server.bindCLIShortcuts;
		callHook(plugin, 'configureServer', {}, server);

		expect(server.config.logger.warn).toHaveBeenCalledOnce();
		expect(deps.startBridge).not.toHaveBeenCalled();
		expect(deps.createTerminal).not.toHaveBeenCalled();
		expect(server.printUrls).toBe(originalPrintUrls);
		expect(server.bindCLIShortcuts).toBe(originalBindCLIShortcuts);
	});

	it('serves a passthrough virtual module for the public Core entry', async () => {
		const { deps } = fakeDeps();
		const plugin = createMakooDev(deps);
		const ctx = {
			resolve: vi.fn().mockResolvedValue({ id: '/resolved/@makoojs/core.js' })
		};
		await callHook(plugin, 'resolveId', ctx, '@makoojs/core', '/project/src/main.ts', {
			isEntry: false
		});

		expect(await callHook(plugin, 'load', {}, '\0virtual:makoo-dev')).toBe(
			'export * from "/resolved/@makoojs/core.js";'
		);
		expect(await callHook(plugin, 'load', {}, '/unrelated')).toBeNull();
	});

	it('closes the bridge and terminal once across repeated closeBundle calls', async () => {
		const { deps, terminal, bridge } = fakeDeps();
		const plugin = createMakooDev(deps);
		const { server, emitListening } = fakeServer();
		callHook(plugin, 'configureServer', {}, server);
		emitListening();
		server.printUrls();
		await vi.waitFor(() => expect(terminal.showHome).toHaveBeenCalledOnce());

		await callHook(plugin, 'closeBundle', {});
		await callHook(plugin, 'closeBundle', {});

		expect(terminal.close).toHaveBeenCalledOnce();
		expect(bridge.close).toHaveBeenCalledOnce();
	});
});
