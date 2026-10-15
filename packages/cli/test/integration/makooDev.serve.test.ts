import path from 'node:path';
import type { MakooRuntime } from '@makoojs/core';
import { createServer, createServerModuleRunner, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevTerminal } from '../../src/cli/commands/dev/DevTerminal';
import { devCommand } from '../../src/cli/commands/dev/dev';
import type { DevSession } from '../../src/session/DevSession';
import type { RuntimeInjection, RuntimeNotice, RuntimeOpen } from '../../src/session/types';
import { makooDev } from '../../src/vite/makooDev';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

const repoRoot = path.resolve(__dirname, '../../../..');
const coreEntry = path.join(repoRoot, 'packages/core/src/index.ts');

type WireMessage =
	| ({ type: 'open' } & RuntimeOpen)
	| ({ type: 'injection' } & RuntimeInjection)
	| ({ type: 'notice' } & RuntimeNotice);

let server: Awaited<ReturnType<typeof createServer>>;
let runner: ReturnType<typeof createServerModuleRunner>;
let entry: {
	applyPanelAndListener(): MakooRuntime;
	applyBrokenPanel(): void;
	applyPanelRemovingLaterListener(): void;
	applyWithThrowingSubscriber(): MakooRuntime;
	applyPanelFailingCleanup(): MakooRuntime;
};
let messages: WireMessage[];
let session: DevSession;

describe('makooDev serve integration', () => {
	beforeEach(async () => {
		const root = await trackProject({
			'src/main.ts': `
				import { createMakoo, inject, listen } from '@makoojs/core';

				function host(id, tag = 'div') {
					const element = document.createElement(tag);
					element.id = id;
					document.body.append(element);
					return element;
				}

				const plainAdapter = { name: 'plain', mount: () => 'handle', unmount: () => {} };

				export function applyPanelAndListener() {
					host('panel-host');
					host('play', 'button');
					const core = createMakoo();
					core.useAdapter(plainAdapter);
					core.apply([
						inject({
							name: 'panel',
							injectAt: '#panel-host',
							adapter: 'plain',
							component: {},
							listeners: [
								listen({ name: 'hover', listenAt: '#panel-host', type: 'mouseenter', callback() {} })
							]
						}),
						listen({ name: 'play-click', listenAt: '#play', type: 'click', callback() {} })
					]);
					return core;
				}

				export function applyPanelRemovingLaterListener() {
					host('panel-host');
					host('play', 'button');
					const core = createMakoo();
					core.useAdapter({
						name: 'remover',
						mount: () => {
							void core.command('play-click').remove();
							return 'handle';
						},
						unmount: () => {}
					});
					core.apply([
						inject({ name: 'panel', injectAt: '#panel-host', adapter: 'remover', component: {} }),
						listen({ name: 'play-click', listenAt: '#play', type: 'click', callback() {} })
					]);
				}

				export function applyWithThrowingSubscriber() {
					host('play', 'button');
					const core = createMakoo();
					core.apply([listen({ name: 'play-click', listenAt: '#play', type: 'click', callback() {} })]);
					core.statusHandle('play-click').subscribe(() => {
						throw new Error('subscriber exploded');
					});
					return core;
				}

				export function applyPanelFailingCleanup() {
					host('panel-host');
					const core = createMakoo();
					core.useAdapter({
						name: 'sticky',
						mount: () => 'handle',
						unmount: () => {
							throw new Error('unmount exploded');
						}
					});
					core.apply([inject({ name: 'sticky', injectAt: '#panel-host', adapter: 'sticky', component: {} })]);
					return core;
				}

				export function applyBrokenPanel() {
					host('panel-host');
					const core = createMakoo();
					core.useAdapter({
						name: 'exploding',
						mount: () => {
							throw new Error('adapter exploded');
						},
						unmount: () => {}
					});
					core.apply([
						inject({ name: 'broken', injectAt: '#panel-host', adapter: 'exploding', component: {} })
					]);
				}
			`
		});

		const devPlugin = makooDev();
		session = devPlugin.api.session;
		server = await createServer({
			root,
			configFile: false,
			logLevel: 'silent',
			server: { middlewareMode: true },
			appType: 'custom',
			plugins: [
				devPlugin,
				{
					name: 'makoo-test-core-resolve',
					resolveId(source) {
						if (source === '@makoojs/core') {
							return coreEntry;
						}
					}
				}
			]
		});
		runner = createServerModuleRunner(server.environments.ssr);

		messages = [];
		const hot = server.environments.ssr.hot;
		hot.on('makoo:runtime:open', (data) =>
			messages.push({ type: 'open', ...(data as RuntimeOpen) })
		);
		hot.on('makoo:runtime:injection', (data) =>
			messages.push({ type: 'injection', ...(data as RuntimeInjection) })
		);
		hot.on('makoo:runtime:notice', (data) =>
			messages.push({ type: 'notice', ...(data as RuntimeNotice) })
		);
		entry = await runner.import('/src/main.ts');
	});

	afterEach(async () => {
		await runner?.close();
		await server?.close();
		vi.restoreAllMocks();
		document.body.replaceChildren();
		await cleanupTempProjects();
	});

	it('opens the runtime and pushes each applied Injection with its real phase', () => {
		entry.applyPanelAndListener();
		expect(messages).toEqual([
			{ type: 'open', runtimeId: 1 },
			{
				type: 'injection',
				runtimeId: 1,
				injection: {
					name: 'panel',
					kind: 'component',
					status: 'mounted',
					attachedListeners: [{ name: 'hover', status: 'bound' }]
				}
			},
			{
				type: 'injection',
				runtimeId: 1,
				injection: { name: 'play-click', kind: 'standalone-listener', status: 'bound' }
			}
		]);
		expect(session.getRuntimeSnapshots()).toEqual([
			{
				clientId: 1,
				runtimeId: 1,
				injections: [
					{
						name: 'panel',
						kind: 'component',
						status: 'mounted',
						attachedListeners: [{ name: 'hover', status: 'bound' }]
					},
					{ name: 'play-click', kind: 'standalone-listener', status: 'bound' }
				],
				diagnostics: []
			}
		]);
	});

	it('streams a later failure with its lastError code and message', async () => {
		entry.applyBrokenPanel();
		await vi.waitFor(() => expect(messages).toHaveLength(3));
		expect(messages).toEqual([
			{ type: 'open', runtimeId: 1 },
			{
				type: 'injection',
				runtimeId: 1,
				injection: {
					name: 'broken',
					kind: 'component',
					status: 'waiting',
					attachedListeners: []
				}
			},
			{
				type: 'injection',
				runtimeId: 1,
				injection: {
					name: 'broken',
					kind: 'component',
					status: 'failed',
					lastError: {
						code: 'MAKOO_MOUNT_FAILED',
						message: 'Failed to mount "broken"',
						cause: 'adapter exploded'
					},
					attachedListeners: []
				}
			}
		]);
		expect(session.getRuntimeSnapshots()[0]?.injections).toEqual([
			{
				name: 'broken',
				kind: 'component',
				status: 'failed',
				lastError: {
					code: 'MAKOO_MOUNT_FAILED',
					message: 'Failed to mount "broken"',
					cause: 'adapter exploded'
				},
				attachedListeners: []
			}
		]);
	});

	it('forwards injection-removed and instance-disposed after the phase reaches idle', async () => {
		const core = entry.applyPanelAndListener();
		messages = [];
		await core.command('play-click').remove();
		expect(messages).toEqual([
			{
				type: 'injection',
				runtimeId: 1,
				injection: { name: 'play-click', kind: 'standalone-listener', status: 'idle' }
			},
			{
				type: 'notice',
				runtimeId: 1,
				notice: { type: 'injection-removed', name: 'play-click' }
			}
		]);
		expect(
			session.getRuntimeSnapshots()[0]?.injections.map((injection) => injection.name)
		).toEqual(['panel']);
		messages = [];
		await core.dispose();
		const panel = (status: string, hover: string) => ({
			type: 'injection',
			runtimeId: 1,
			injection: {
				name: 'panel',
				kind: 'component',
				status,
				attachedListeners: [{ name: 'hover', status: hover }]
			}
		});
		expect(messages).toEqual([
			panel('mounted', 'idle'),
			panel('idle', 'idle'),
			{ type: 'notice', runtimeId: 1, notice: { type: 'injection-removed', name: 'panel' } },
			{ type: 'notice', runtimeId: 1, notice: { type: 'instance-disposed' } }
		]);
		expect(session.getRuntimeSnapshots()).toEqual([]);
		expect(session.isEmpty()).toBe(false);
	});

	it('clears only the CLI session when the page client disconnects', async () => {
		const core = entry.applyPanelAndListener();
		expect(session.getRuntimeSnapshots()).toHaveLength(1);
		messages = [];

		await runner.close();

		expect(session.isEmpty()).toBe(true);
		expect(session.getRuntimeSnapshots()).toEqual([]);
		expect(messages).toEqual([]);
		expect(core.statusHandle('panel').getSnapshot()).toBe('mounted');
		expect(core.statusHandle('play-click').getSnapshot()).toBe('bound');
	});

	it('keeps an Injection retained by a cleanup failure visible as failed', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const core = entry.applyPanelFailingCleanup();
		messages = [];
		await expect(core.command('sticky').remove()).rejects.toMatchObject({
			code: 'MAKOO_INJECTION_CLEANUP_FAILED'
		});

		expect(messages.some((message) => message.type === 'notice')).toBe(false);
		expect(session.getRuntimeSnapshots()[0]?.injections).toEqual([
			{
				name: 'sticky',
				kind: 'component',
				status: 'failed',
				lastError: {
					code: 'MAKOO_INJECTION_CLEANUP_FAILED',
					message: 'Cleanup failed for "sticky"\nFailed to unmount "sticky"'
				},
				attachedListeners: []
			}
		]);
	});

	it('skips an Injection that an earlier mount in the same batch already removed', () => {
		entry.applyPanelRemovingLaterListener();
		expect(messages).toEqual([
			{ type: 'open', runtimeId: 1 },
			{
				type: 'notice',
				runtimeId: 1,
				notice: { type: 'injection-removed', name: 'play-click' }
			},
			{
				type: 'injection',
				runtimeId: 1,
				injection: {
					name: 'panel',
					kind: 'component',
					status: 'mounted',
					attachedListeners: []
				}
			}
		]);
	});

	it('forwards a diagnostic as a notice beside the real phase change', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const core = entry.applyWithThrowingSubscriber();
		messages = [];
		await core.command('play-click').stop();
		expect(messages).toEqual([
			{
				type: 'injection',
				runtimeId: 1,
				injection: { name: 'play-click', kind: 'standalone-listener', status: 'idle' }
			},
			{
				type: 'notice',
				runtimeId: 1,
				notice: {
					type: 'diagnostic',
					name: 'play-click',
					error: {
						code: 'MAKOO_STATE_SUBSCRIBER_FAILED',
						message: 'State subscriber of "play-click" failed',
						cause: 'subscriber exploded'
					}
				}
			}
		]);
		const [runtime] = session.getRuntimeSnapshots();
		expect(runtime?.injections).toEqual([
			{ name: 'play-click', kind: 'standalone-listener', status: 'idle' }
		]);
		expect(runtime?.diagnostics).toEqual([
			{
				type: 'diagnostic',
				name: 'play-click',
				error: {
					code: 'MAKOO_STATE_SUBSCRIBER_FAILED',
					message: 'State subscriber of "play-click" failed',
					cause: 'subscriber exploded'
				}
			}
		]);
	});
});

describe('devCommand serve integration', () => {
	it('serves the supplied project root and keeps serving after a restart', async () => {
		const root = await trackProject({ 'index.html': '<h1>real dev project</h1>' });
		const start = vi.spyOn(DevTerminal.prototype, 'start');
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
		} finally {
			const terminal = start.mock.contexts[0];
			if (terminal instanceof DevTerminal) terminal.close();
			await liveServer?.close();
			vi.restoreAllMocks();
			vi.unstubAllEnvs();
			await cleanupTempProjects();
		}
	});
});
