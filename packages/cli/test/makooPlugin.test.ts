import path from 'node:path';
import type { ConfigEnv, Plugin, ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	FAKE_ENTRY,
	FAKE_RESOLVED_ID,
	RESOLVED_ID,
	VIRTUAL_MODULE_ID
} from '../src/config/defaults';
import { resolveConfig } from '../src/config/resolve';
import { makooMonkey } from '../src/vitePlugin/makooMonkey';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

type Hook = (...args: unknown[]) => unknown;

const getHook = (hook: unknown): Hook | undefined => {
	if (typeof hook === 'function') {
		return hook as Hook;
	}
	if (hook && typeof hook === 'object' && 'handler' in hook) {
		const handler = (hook as { handler?: unknown }).handler;
		if (typeof handler === 'function') {
			return handler as Hook;
		}
	}
};

const createProject = async (files: Record<string, string> = {}) => {
	const root = await trackProject({
		'injections/manifest.ts': `
			export default {
				injections: [{ name: 'widget', injectAt: '#app', component: './widget/App.tsx', framework: 'React' }]
			};
		`,
		'injections/widget/App.tsx': 'export default function App() { return null; }',
		...files
	});
	const config = resolveConfig(
		{
			app: { name: 'plugin-test', version: '0.0.1' }
		},
		root
	);
	return { root, plugin: makooMonkey(config) as Plugin };
};

const createDevServer = () =>
	({
		watcher: {
			add: vi.fn(),
			on: vi.fn()
		},
		moduleGraph: {
			getModuleById: vi.fn(() => undefined),
			invalidateModule: vi.fn()
		},
		hot: {
			send: vi.fn()
		}
	}) as unknown as ViteDevServer;

afterEach(cleanupTempProjects);

describe('makooMonkey', () => {
	it('resolves virtual module id and returns empty module before scanning', () => {
		const config = resolveConfig(
			{ app: { name: 'plugin-test', version: '0.0.1' } },
			path.resolve('/project')
		);
		const plugin = makooMonkey(config) as Plugin;
		const resolveId = getHook(plugin.resolveId);
		const load = getHook(plugin.load);

		expect(resolveId?.call({} as never, VIRTUAL_MODULE_ID)).toBe(RESOLVED_ID);
		expect(resolveId?.call({} as never, `./${FAKE_ENTRY}`)).toBe(FAKE_RESOLVED_ID);
		expect(resolveId?.call({} as never, '/entry.ts')).toBeUndefined();
		expect(load?.call({} as never, RESOLVED_ID, {} as never)).toBe('export {}');
		expect(load?.call({} as never, FAKE_RESOLVED_ID, {} as never)).toBe('export {}');
		expect(load?.call({} as never, '/entry.ts', {} as never)).toBeUndefined();
	});

	it('scans on buildStart and serves generated virtual module code', async () => {
		const { root, plugin } = await createProject();
		const buildStart = getHook(plugin.buildStart);
		const load = getHook(plugin.load);

		await withCwd(root, async () => {
			await buildStart?.call({} as never, {} as never);
			const code = await load?.call({} as never, RESOLVED_ID, {} as never);

			expect(String(code)).toContain('register("#app"');
			expect(String(code)).not.toContain('import.meta.hot.accept');
		});
	});

	it('marks dev mode during config and includes HMR accept code in virtual module', async () => {
		const { root, plugin } = await createProject();
		const configHook = getHook(plugin.config);
		const buildStart = getHook(plugin.buildStart);
		const load = getHook(plugin.load);

		await withCwd(root, async () => {
			await configHook?.call({} as never, {}, {
				command: 'serve',
				mode: 'development'
			} as ConfigEnv);
			await buildStart?.call({} as never, {} as never);
			const code = await load?.call({} as never, RESOLVED_ID, {} as never);

			expect(String(code)).toContain('register("#app"');
			expect(String(code)).toContain('import.meta.hot.accept');
			expect(String(code)).toContain("import.meta.hot.on('makoo:structural-hmr'");
			expect(String(code)).toContain('%c[makoo]%c structural HMR');
			expect(String(code)).toContain('color:#42b883');
		});
	});

	it('sends scan errors to dev server during configureServer', async () => {
		const root = await trackProject({ 'package.json': '{}' });
		const config = resolveConfig(
			{
				app: { name: 'plugin-error', version: '0.0.1' }
			},
			root
		);
		const plugin = makooMonkey(config) as Plugin;
		const configureServer = getHook(plugin.configureServer);
		const server = createDevServer();

		await withCwd(root, async () => {
			await configureServer?.call({} as never, server as never);
		});

		expect(server.hot.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'error',
				err: expect.objectContaining({
					message: expect.stringContaining('[makoo]'),
					plugin: 'vite-plugin-makoo',
					id: RESOLVED_ID
				})
			})
		);
		expect(server.watcher.add).not.toHaveBeenCalled();
	});
});
