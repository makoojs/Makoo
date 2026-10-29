import type { NormalizedHotChannelClient } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { makoo } from '../../src/vite/makoo';
import { bindDevSession, makooDev } from '../../src/vite/makooDev';
import type { DevSession } from '../../src/vite/session';

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

	it('keeps sessions isolated between dev server instances', () => {
		const first = makooDev().api.session as DevSession;
		const second = makooDev().api.session as DevSession;
		first.open({} as NormalizedHotChannelClient, { runtimeId: 1 });
		expect(first.getRuntimeSnapshots()).toHaveLength(1);
		expect(second.getRuntimeSnapshots()).toEqual([]);
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

	it('updates the DevSession from clients of every Vite environment', () => {
		const plugin = makooDev();
		const configureServer = getHookHandler(plugin.configureServer);
		if (!configureServer) {
			throw new Error('expected configureServer hook');
		}
		const session = plugin.api?.session as DevSession;
		const onChange = vi.fn();
		session.subscribe(onChange);

		const clientOn = vi.fn();
		const ssrOn = vi.fn();
		configureServer.call(
			{} as never,
			{
				environments: { client: { hot: { on: clientOn } }, ssr: { hot: { on: ssrOn } } },
				config: { inlineConfig: {} },
				httpServer: { once: vi.fn() }
			} as never
		);

		const getListener = (on: typeof clientOn, name: string) => {
			const listener = on.mock.calls.find(([event]) => event === name)?.[1] as
				| ((payload: unknown, client: unknown) => void)
				| undefined;
			if (!listener) throw new Error(`expected ${name} listener`);
			return listener;
		};

		const page = {};
		getListener(clientOn, 'makoo:runtime:open')({ runtimeId: 1 }, page);
		getListener(clientOn, 'makoo:runtime:injection')(
			{
				runtimeId: 1,
				injection: { name: 'play-click', kind: 'standalone-listener', status: 'bound' }
			},
			page
		);
		getListener(clientOn, 'makoo:runtime:notice')(
			{
				runtimeId: 1,
				notice: { type: 'diagnostic', error: { code: 'MAKOO_X', message: 'x' } }
			},
			page
		);
		expect(session.getRuntimeSnapshots()).toEqual([
			{
				clientId: 1,
				runtimeId: 1,
				injections: [{ name: 'play-click', kind: 'standalone-listener', status: 'bound' }],
				diagnostics: [{ type: 'diagnostic', error: { code: 'MAKOO_X', message: 'x' } }]
			}
		]);
		expect(onChange).toHaveBeenCalledTimes(3);

		const runner = {};
		getListener(ssrOn, 'makoo:runtime:open')({ runtimeId: 1 }, runner);
		expect(session.getRuntimeSnapshots()).toHaveLength(2);

		getListener(clientOn, 'vite:client:disconnect')(undefined, page);
		getListener(ssrOn, 'vite:client:disconnect')(undefined, runner);
		expect(session.isEmpty()).toBe(true);
		expect(session.getRuntimeSnapshots()).toEqual([]);
	});

	it('rebinds the DevSession when Vite restarts from inlineConfig', () => {
		const plugin = makooDev();
		const configureServer = getHookHandler(plugin.configureServer);
		if (!configureServer) throw new Error('expected configureServer hook');

		const bind = vi.fn();
		configureServer.call(
			{} as never,
			{
				environments: {},
				config: { inlineConfig: { [bindDevSession]: bind } },
				httpServer: { once: vi.fn() }
			} as never
		);

		expect(bind).toHaveBeenCalledWith(plugin.api?.session);
	});
});
