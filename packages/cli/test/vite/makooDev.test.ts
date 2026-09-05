import { describe, expect, it, vi } from 'vitest';
import { DevSession } from '../../src/session/DevSession';
import { makoo } from '../../src/vite/makoo';
import { bindDevSession, makooDev } from '../../src/vite/makooDev';

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
	it('is an independent serve-only plugin', () => {
		const plugin = makooDev();

		expect(plugin.name).toBe('makoo:dev');
		expect(plugin.apply).toBe('serve');
		expect(plugin.enforce).toBe('pre');
		expect(plugin.configureServer).toBeTypeOf('function');
		expect(plugin.api?.session).toBeInstanceOf(DevSession);
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
	});

	it('updates the DevSession from connected Vite clients', () => {
		const plugin = makooDev();
		const configureServer = getHookHandler(plugin.configureServer);
		if (!configureServer) {
			throw new Error('expected configureServer hook');
		}
		const session = plugin.api?.session as DevSession;
		const onChange = vi.fn();
		session.subscribe(onChange);

		const on = vi.fn();
		configureServer.call(
			{} as never,
			{
				hot: { on },
				config: { inlineConfig: {} }
			} as never
		);

		const getListener = (name: string) => {
			const listener = on.mock.calls.find(([event]) => event === name)?.[1] as
				| ((payload: unknown, client: unknown) => void)
				| undefined;
			if (!listener) throw new Error(`expected ${name} listener`);
			return listener;
		};

		const client = {};
		getListener('makoo:runtime:open')({ runtimeId: 1 }, client);
		getListener('makoo:runtime:event')(
			{
				runtimeId: 1,
				event: {
					name: 'register:success',
					ts: 1,
					taskId: 'task-1',
					kind: 'component',
					status: 'idle',
					injectAt: '#app',
					meta: { artifactName: 'Demo' }
				}
			},
			client
		);

		expect(session.getTasks()).toMatchObject([
			{
				clientId: 1,
				runtimeId: 1,
				tasks: [{ taskId: 'task-1', status: 'idle' }]
			}
		]);
		expect(session.getLogs().map((log) => log.event.name)).toEqual(['register:success']);
		expect(onChange).toHaveBeenCalledTimes(2);

		getListener('makoo:runtime:event')(
			{
				runtimeId: 1,
				event: {
					name: 'task:statusChange',
					ts: 2,
					taskId: 'task-1',
					status: 'active'
				}
			},
			client
		);
		expect(session.getTasks()).toMatchObject([
			{
				tasks: [{ taskId: 'task-1', status: 'active' }]
			}
		]);

		getListener('vite:client:disconnect')(undefined, client);
		expect(session.isEmpty()).toBe(true);
		expect(session.getTasks()).toEqual([]);
		expect(session.getLogs()).toEqual([]);

		const reconnectedClient = {};
		getListener('makoo:runtime:open')({ runtimeId: 1 }, reconnectedClient);
		getListener('makoo:runtime:event')(
			{
				runtimeId: 1,
				event: {
					name: 'register:success',
					ts: 3,
					taskId: 'task-2',
					kind: 'listener',
					status: 'idle',
					injectAt: 'window'
				}
			},
			reconnectedClient
		);
		expect(session.getTasks()).toMatchObject([
			{
				tasks: [{ taskId: 'task-2', status: 'idle' }]
			}
		]);
	});

	it('rebinds the DevSession when Vite restarts from inlineConfig', () => {
		const plugin = makooDev();
		const configureServer = getHookHandler(plugin.configureServer);
		if (!configureServer) throw new Error('expected configureServer hook');

		const bind = vi.fn();
		configureServer.call(
			{} as never,
			{
				hot: { on: vi.fn() },
				config: { inlineConfig: { [bindDevSession]: bind } }
			} as never
		);

		expect(bind).toHaveBeenCalledWith(plugin.api?.session);
	});
});
