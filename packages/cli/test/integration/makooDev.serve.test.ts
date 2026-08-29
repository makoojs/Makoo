import path from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { makooDev } from '../../src/vite/makooDev';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

const repoRoot = path.resolve(__dirname, '../../../..');
const coreEntry = path.join(repoRoot, 'packages/core/src/index.ts');

type RuntimeOpenMessage = {
	runtime: number;
};

type RuntimeEventMessage = {
	runtime: number;
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

afterEach(cleanupTempProjects);

describe('makooDev serve integration', () => {
	it('executes the virtual Core and sends runtime events without replacing the user observer', async () => {
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

		const server = await createServer({
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
		const runner = createServerModuleRunner(server.environments.ssr);
		const opens: RuntimeOpenMessage[] = [];
		const events: RuntimeEventMessage[] = [];
		server.environments.ssr.hot.on('makoo:runtime:open', (data) => {
			opens.push(data as RuntimeOpenMessage);
		});
		server.environments.ssr.hot.on('makoo:runtime:event', (data) => {
			events.push(data as RuntimeEventMessage);
		});

		try {
			const entry = await runner.import<{
				run(): string[];
				runStoppedPropagation(): { scoped: number; any: number };
				failCreate(): void;
			}>('/src/main.ts');
			const observed = entry.run();

			expect(opens).toEqual([{ runtime: 1 }]);
			expect(events.map(({ event }) => event.name)).toEqual(observed);

			const mountFailure = events.find(({ event }) => event.name === 'artifact:mountFail');
			expect(mountFailure?.event.error).toMatchObject({
				name: 'AdapterError',
				code: 'MAKOO_ADAPTER_MOUNT_FAIL',
				summary: 'Failed to mount artifact at "#makoo-dev-target"',
				issues: [],
				context: {
					taskId: 'broken-task',
					artifact: 'BrokenArtifact',
					injectAt: '#makoo-dev-target',
					adapter: 'failing-adapter'
				}
			});

			const beforeStoppedRun = events.length;
			expect(entry.runStoppedPropagation()).toEqual({ scoped: 1, any: 0 });
			expect(opens).toEqual([{ runtime: 1 }, { runtime: 2 }]);
			expect(events.slice(beforeStoppedRun)).toEqual([
				{
					runtime: 2,
					event: expect.objectContaining({ name: 'start:requested' })
				}
			]);

			entry.failCreate();
			expect(opens).toEqual([{ runtime: 1 }, { runtime: 2 }]);
		} finally {
			await runner.close();
			await server.close();
		}
	});
});
