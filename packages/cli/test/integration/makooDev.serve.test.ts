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
		error?: {
			name: string;
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
	run(): string[];
	runStoppedPropagation(): { scoped: number; any: number };
	failCreate(): void;
};
let opens: SessionOpenMessage[];
let events: MakooEventMessage[];

describe('makooDev serve integration', () => {
	beforeEach(async () => {
		const root = await trackProject({
			'src/main.ts': `
				import { createMakoo, createObserverHub, inject } from '@makoojs/core';

				export function run() {
					const target = document.createElement('div');
					target.id = 'makoo-dev-target';
					document.body.appendChild(target);

					const observed = [];
					const observer = createObserverHub();
					observer.onAny((event) => observed.push(event.name));

					const tasks = createMakoo({
						observer,
						adapters: [{
							name: 'failing-adapter',
							matches: () => true,
							mount: () => {
								throw new Error('adapter exploded');
							}
						}]
					}).start([
						inject({
							id: 'broken-task',
							injectAt: '#makoo-dev-target',
							artifact: function BrokenArtifact() {}
						})
					]);

					tasks.destroyAll();
					target.remove();
					return observed;
				}

				export function runStoppedPropagation() {
					let scoped = 0;
					let any = 0;
					const observer = createObserverHub();
					observer.on('start:requested', (_event, ctrl) => {
						scoped += 1;
						ctrl.stopPropagation();
					});
					observer.onAny(() => {
						any += 1;
					});

					try {
						createMakoo({ observer }).start([]);
					} catch {}

					return { scoped, any };
				}

				export function failCreate() {
					const observer = createObserverHub();
					observer.on = () => {
						throw new Error('custom observer failed');
					};

					try {
						createMakoo({
							observer,
							hooks: { 'start:requested': () => {} }
						});
					} catch {}
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

	it('forwards observed events and serializes Makoo errors', () => {
		const observed = entry.run();
		expect(opens).toEqual([{ runtimeId: 1 }]);
		expect(observed).toContain('artifact:mountFail');
		expect(events.map(({ event }) => event.name)).toEqual(observed);
		const failure = events.find(({ event }) => event.name === 'artifact:mountFail');
		expect(failure?.event.error).toMatchObject({
			name: 'AdapterError',
			code: 'MAKOO_ADAPTER_MOUNT_FAIL',
			summary: 'Failed to mount artifact at "#makoo-dev-target"',
			context: {
				taskId: 'broken-task',
				artifact: 'BrokenArtifact',
				injectAt: '#makoo-dev-target',
				adapter: 'failing-adapter'
			}
		});
	});

	it('reports events even when the user observer stops propagation', () => {
		expect(entry.runStoppedPropagation()).toEqual({ scoped: 1, any: 0 });
		expect(opens).toEqual([{ runtimeId: 1 }]);
		expect(events).toEqual([
			{ runtimeId: 1, event: expect.objectContaining({ name: 'start:requested' }) }
		]);
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
