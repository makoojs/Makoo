import path from 'node:path';
import { createServer, createServerModuleRunner, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevTerminal } from '../../src/cli/commands/dev/DevTerminal';
import { devCommand } from '../../src/cli/commands/dev/dev';
import { makooDev } from '../../src/vite/makooDev';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

const repoRoot = path.resolve(__dirname, '../../../..');
const coreEntry = path.join(repoRoot, 'packages/core/src/index.ts');

type SessionOpenMessage = {
	runtimeId: number;
};

type MakooEventMessage = {
	runtimeId: number;
	event: {
		name: string;
		status?: string;
		taskId?: string;
		error?: {
			name?: string;
			message: string;
			code?: string;
			summary?: string;
			issues?: Array<{ path: string; message: string }>;
			context?: Record<string, string | number | boolean | null>;
		};
	};
};

let server: Awaited<ReturnType<typeof createServer>>;
let runner: ReturnType<typeof createServerModuleRunner>;
let entry: {
	run(): Promise<string[]> | string[];
	runFailingObserver(): Promise<{ observed: number }> | { observed: number };
	failCreate(): void;
};
let opens: SessionOpenMessage[];
let events: MakooEventMessage[];

describe('makooDev serve integration', () => {
	beforeEach(async () => {
		const root = await trackProject({
			'src/main.ts': `
				import { createMakoo, inject } from '@makoojs/core';

				export async function run() {
					const target = document.createElement('div');
					target.id = 'makoo-dev-target';
					document.body.appendChild(target);

					const observed = [];
					const makoo = createMakoo();
					makoo.observe((notice) => observed.push(notice.type));

					makoo.useAdapter({
						name: 'failing-adapter',
						mount: () => {
							throw new Error('adapter exploded');
						},
						unmount: () => {}
					});

					makoo.apply([
						inject({
							name: 'broken-task',
							injectAt: '#makoo-dev-target',
							adapter: 'failing-adapter',
							component: function BrokenArtifact() {}
						})
					]);

					const handle = makoo.statusHandle('broken-task');
					if (handle.getSnapshot() !== 'failed') {
						await new Promise((resolve) => {
							const stop = handle.subscribe(() => {
								if (handle.getSnapshot() === 'failed') {
									stop();
									resolve(undefined);
								}
							});
						});
					}

					await makoo.dispose();
					target.remove();
					return observed;
				}

				export async function runFailingObserver() {
					let observed = 0;
					const makoo = createMakoo();
					makoo.observe(() => {
						observed += 1;
						throw new Error('user observer failed');
					});

					makoo.useAdapter({
						name: 'plain',
						mount: () => 'handle',
						unmount: () => {}
					});

					makoo.apply([
						inject({
							name: 'normal-task',
							injectAt: '#makoo-dev-target',
							adapter: 'plain',
							component: function Dummy() {}
						})
					]);

					await makoo.dispose();
					return { observed };
				}

				export function failCreate() {
					const originalMap = globalThis.Map;
					try {
						globalThis.Map = class extends originalMap {
							constructor(entries) {
								super(entries);
								throw new Error('runtime map allocation failed');
							}
						};
						createMakoo();
					} catch {} finally {
						globalThis.Map = originalMap;
					}
				}
			`
		});

		server = await createServer({
			root,
			configFile: false,
			logLevel: 'silent',
			server: { middlewareMode: true },
			appType: 'custom',
			plugins: [
				makooDev(),
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

		opens = [];
		events = [];
		server.environments.ssr.hot.on('makoo:runtime:open', (data) =>
			opens.push(data as SessionOpenMessage)
		);
		server.environments.ssr.hot.on('makoo:runtime:event', (data) =>
			events.push(data as MakooEventMessage)
		);
		entry = await runner.import('/src/main.ts');
	});

	afterEach(async () => {
		await runner?.close();
		await server?.close();
		vi.restoreAllMocks();
		await cleanupTempProjects();
	});

	it('forwards observed events and serializes Makoo errors', async () => {
		const observed = await entry.run();
		expect(opens).toEqual([{ runtimeId: 1 }]);
		expect(observed).toContain('instance-disposed');
		const failure = events.find(
			({ event }) => event.name === 'task:statusChange' && event.status === 'failed'
		);
		expect(failure?.event.error).toMatchObject({
			name: 'MakooError',
			code: 'MAKOO_MOUNT_FAILED',
			message: 'Failed to mount "broken-task"'
		});
	});

	it('reports events even when a user observer throws', async () => {
		const result = await entry.runFailingObserver();
		expect(result.observed).toBeGreaterThanOrEqual(1);
		expect(opens).toEqual([{ runtimeId: 1 }]);
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					runtimeId: 1,
					event: expect.objectContaining({ name: 'diagnostic' })
				})
			])
		);
	});

	it('does not announce a runtime when creation fails', () => {
		entry.failCreate();
		expect(opens).toEqual([]);
		expect(events).toEqual([]);
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
