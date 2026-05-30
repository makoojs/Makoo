import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigEnv, Plugin, ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESOLVED_ID } from '../src/config/defaults';
import { resolveConfig } from '../src/config/resolve';
import { makooMonkey } from '../src/vitePlugin/makooMonkey';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

type WatchHandler = (file: string) => Promise<void> | void;
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

const createDevServer = () => {
	const handlers = new Map<string, WatchHandler[]>();
	const virtualModule = { id: RESOLVED_ID };
	const invalidateModule = vi.fn();
	const hotSend = vi.fn();
	const watcherAdd = vi.fn();
	const watcherOn = vi.fn((event: string, handler: WatchHandler) => {
		const current = handlers.get(event) ?? [];
		current.push(handler);
		handlers.set(event, current);
	});

	const server = {
		watcher: {
			add: watcherAdd,
			on: watcherOn
		},
		moduleGraph: {
			getModuleById: vi.fn((id: string) => (id === RESOLVED_ID ? virtualModule : undefined)),
			invalidateModule
		},
		hot: {
			send: hotSend
		}
	} as unknown as ViteDevServer;

	return {
		server,
		invalidateModule,
		hotSend,
		watcherAdd,
		async emit(event: string, file: string) {
			for (const handler of handlers.get(event) ?? []) {
				await handler(file);
			}
		}
	};
};

const createProject = async () => {
	const root = await trackProject({
		'injections/manifest.ts': `
			export default {
				injections: {
					widget: { injectAt: '#old', component: './widget/App.tsx', framework: 'React' }
				}
			};
		`,
		'injections/widget/App.tsx': 'export default function App() { return null; }'
	});
	const config = resolveConfig(
		{
			app: { name: 'hmr-script', version: '0.0.1' }
		},
		root
	);
	const plugin = makooMonkey(config) as Plugin;
	return { root, config, plugin };
};

const configureDevPlugin = async (plugin: Plugin, server: ViteDevServer) => {
	const configHook = getHook(plugin.config);
	if (configHook) {
		await configHook.call({} as never, {}, {
			command: 'serve',
			mode: 'development'
		} as ConfigEnv);
	}
	const configureServer = getHook(plugin.configureServer);
	if (configureServer) {
		await configureServer.call({} as never, server as never);
	}
};

describe('makooMonkey dev HMR', () => {
	it('rescans, invalidates virtual module and sends HMR update when manifest metadata changes', async () => {
		const { root, plugin } = await createProject();
		const dev = createDevServer();

		await withCwd(root, async () => {
			await configureDevPlugin(plugin, dev.server);

			const load = getHook(plugin.load);
			const initialCode = await load?.call({}, RESOLVED_ID, {});
			expect(String(initialCode)).toContain('register("#old"');

			const manifestFile = path.join(root, 'injections/manifest.ts');
			await writeFile(
				manifestFile,
				`
					export default {
						injections: {
							widget: { injectAt: '#new', component: './widget/App.tsx', framework: 'React' }
						}
					};
				`
			);
			await dev.emit('change', manifestFile);

			const updatedCode = await load?.call({} as never, RESOLVED_ID, {} as never);
			expect(String(updatedCode)).toContain('register("#new"');
			expect(dev.invalidateModule).toHaveBeenCalledTimes(1);
			expect(dev.hotSend).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'update',
					updates: [
						expect.objectContaining({
							type: 'js-update',
							path: RESOLVED_ID,
							acceptedPath: RESOLVED_ID
						})
					]
				})
			);
		});
	});

	it('does not rescan or invalidate virtual module when a component changes', async () => {
		const { root, plugin } = await createProject();
		const dev = createDevServer();
		const componentModule = { id: path.join(root, 'injections/widget/App.tsx') };

		await withCwd(root, async () => {
			await configureDevPlugin(plugin, dev.server);

			const load = getHook(plugin.load);
			const initialCode = await load?.call({} as never, RESOLVED_ID, {} as never);
			expect(String(initialCode)).toContain('register("#old"');

			const manifestFile = path.join(root, 'injections/manifest.ts');
			await writeFile(
				manifestFile,
				`
					export default {
						injections: {
							widget: { injectAt: '#new', component: './widget/App.tsx', framework: 'React' }
						}
					};
				`
			);
			const componentFile = path.join(root, 'injections/widget/App.tsx');
			await writeFile(componentFile, 'export default function App() { return "changed"; }');
			await dev.emit('change', componentFile);

			const handleHotUpdate = getHook(plugin.handleHotUpdate);
			const result = handleHotUpdate?.call(
				{} as never,
				{
					file: componentFile,
					modules: [componentModule]
				} as never
			);
			const currentCode = await load?.call({} as never, RESOLVED_ID, {} as never);

			expect(result).toEqual([componentModule]);
			expect(String(currentCode)).toContain('register("#old"');
			expect(dev.invalidateModule).not.toHaveBeenCalled();
			expect(dev.hotSend).not.toHaveBeenCalled();
		});
	});
});
