import type { MakooRuntime, MountAdapter } from '@makoojs/core';
import { createMakoo, inject, injectEach, listen } from '@makoojs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DevEndpoint, PageRuntimeRow } from '../../src/bridge/protocol';
import {
	closePageReporters,
	createDevframeReporter,
	instrument,
	type PageReporter
} from '../../src/bridge/runtime';

const endpoint: DevEndpoint = { host: '127.0.0.1', port: 19999, token: 'test-token' };

const fakeAdapter: MountAdapter = {
	name: 'fake',
	mount: () => ({}),
	unmount: () => {}
};

function fakeReporter() {
	const submits: PageRuntimeRow[][] = [];
	const reporter: PageReporter = {
		submit: (rows) => {
			submits.push(rows);
		},
		close: vi.fn()
	};
	return { reporter, submits, last: () => submits.at(-1) };
}

function fakeClient() {
	const statusHandlers: ((status: string) => void)[] = [];
	const resolvers: (() => void)[] = [];
	const client = {
		status: 'connecting',
		calls: [] as PageRuntimeRow[][],
		events: {
			on: (_event: string, handler: (status: string) => void) => {
				statusHandlers.push(handler);
			}
		},
		call: vi.fn((_method: string, rows: PageRuntimeRow[]) => {
			client.calls.push(rows);
			return new Promise<void>((resolve) => resolvers.push(resolve));
		}),
		get handlerCount() {
			return statusHandlers.length;
		},
		close: vi.fn(),
		emit(status: string) {
			client.status = status;
			for (const handler of [...statusHandlers]) handler(status);
		},
		settle() {
			const pending = resolvers.splice(0);
			for (const resolve of pending) resolve();
		}
	};
	return client;
}

async function settled(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

afterEach(() => {
	document.body.innerHTML = '';
	closePageReporters();
});

describe('instrument', () => {
	it('submits a new empty row when a runtime opens', () => {
		const { reporter, submits } = fakeReporter();
		const wrapped = instrument(createMakoo, endpoint, reporter);

		wrapped();

		expect(submits).toHaveLength(1);
		expect(submits[0]).toEqual([{ runtimeId: 1, injections: [], diagnostics: [] }]);
	});

	it('collects standalone listeners and components with attached listeners', async () => {
		const { reporter, last } = fakeReporter();
		const wrapped = instrument(createMakoo, endpoint, reporter);
		const runtime = wrapped();
		document.body.innerHTML = '<div id="app"></div><button id="save"></button>';

		runtime.useAdapter(fakeAdapter);
		runtime.apply([
			listen({ name: 'save-click', listenAt: '#save', type: 'click', callback: () => {} }),
			inject({
				name: 'panel',
				injectAt: '#app',
				adapter: 'fake',
				component: {},
				listeners: [
					listen({
						name: 'on-save',
						listenAt: '#save',
						type: 'click',
						callback: () => {}
					})
				]
			})
		]);

		await vi.waitFor(() => {
			expect(last()?.[0]?.injections).toEqual([
				expect.objectContaining({
					name: 'save-click',
					kind: 'standalone-listener',
					status: 'bound'
				}),
				expect.objectContaining({
					name: 'panel',
					kind: 'component',
					status: 'mounted',
					attachedListeners: [{ name: 'on-save', status: 'bound' }]
				})
			]);
		});
	});

	it('reports component-each children as anonymous status rows', async () => {
		const { reporter, last } = fakeReporter();
		const wrapped = instrument(createMakoo, endpoint, reporter);
		const runtime = wrapped();
		document.body.innerHTML = '<div class="card"></div><div class="card"></div>';

		runtime.useAdapter(fakeAdapter);
		runtime.apply([
			injectEach({ name: 'cards', injectAt: '.card', adapter: 'fake', component: {} })
		]);

		await vi.waitFor(() => {
			expect(last()?.[0]?.injections).toEqual([
				expect.objectContaining({
					name: 'cards',
					kind: 'component-each',
					status: 'collecting',
					children: [{ status: 'mounted' }, { status: 'mounted' }]
				})
			]);
		});
	});

	it('keeps only the latest five diagnostics', async () => {
		const { reporter, last } = fakeReporter();
		const wrapped = instrument(createMakoo, endpoint, reporter);
		const runtime = wrapped();

		runtime.apply([
			listen({ name: 'l', listenAt: '#missing', type: 'click', callback: () => {} })
		]);
		const handle = runtime.listener('l').statusHandle;
		for (let i = 0; i < 6; i++) {
			handle.subscribe(() => {
				throw new Error(`boom${i}`);
			});
		}
		await runtime.listener('l').command.stop();

		await vi.waitFor(() => {
			expect(last()?.[0]?.diagnostics).toHaveLength(5);
		});
		const causes = last()?.[0]?.diagnostics.map((diagnostic) => diagnostic.error.cause);
		expect(causes).toEqual(['boom1', 'boom2', 'boom3', 'boom4', 'boom5']);
	});

	it('drops removed injections and disposed runtimes', async () => {
		const { reporter, last } = fakeReporter();
		const wrapped = instrument(createMakoo, endpoint, reporter);
		const runtime = wrapped();
		document.body.innerHTML = '<button id="save"></button>';

		runtime.apply([
			listen({ name: 'save-click', listenAt: '#save', type: 'click', callback: () => {} })
		]);
		await vi.waitFor(() => expect(last()?.[0]?.injections).toHaveLength(1));

		await runtime.listener('save-click').command.remove();
		expect(last()?.[0]?.injections).toEqual([]);

		await runtime.dispose();
		expect(last()).toEqual([]);
	});

	it('tracks multiple runtimes as separate rows', () => {
		const { reporter, last } = fakeReporter();
		const wrapped = instrument(createMakoo, endpoint, reporter);

		const first: MakooRuntime = wrapped();
		wrapped();
		first.apply([
			listen({ name: 'l', listenAt: '#missing', type: 'click', callback: () => {} })
		]);

		expect(last()).toEqual([
			{
				runtimeId: 1,
				injections: [expect.objectContaining({ name: 'l', kind: 'standalone-listener' })],
				diagnostics: []
			},
			{ runtimeId: 2, injections: [], diagnostics: [] }
		]);
	});
});

describe('createDevframeReporter', () => {
	it('sends the current table once the client reports connected', async () => {
		const client = fakeClient();
		const connect = vi.fn(async () => client);
		const reporter = createDevframeReporter(endpoint, {
			connect,
			reconnectDelayMs: 0
		});

		const rows: PageRuntimeRow[] = [{ runtimeId: 1, injections: [], diagnostics: [] }];
		reporter.submit(rows);
		expect(client.calls).toHaveLength(0);

		await vi.waitFor(() => expect(client.handlerCount).toBe(1));
		client.emit('connected');

		await vi.waitFor(() => expect(client.calls).toEqual([rows]));
		reporter.close();
	});

	it('sends only the newest table while a call is in flight', async () => {
		const client = fakeClient();
		const reporter = createDevframeReporter(endpoint, {
			connect: async () => client,
			reconnectDelayMs: 0
		});
		await vi.waitFor(() => expect(client.handlerCount).toBe(1));
		client.emit('connected');

		const oldest: PageRuntimeRow[] = [{ runtimeId: 1, injections: [], diagnostics: [] }];
		const middle: PageRuntimeRow[] = [{ runtimeId: 2, injections: [], diagnostics: [] }];
		const newest: PageRuntimeRow[] = [{ runtimeId: 3, injections: [], diagnostics: [] }];
		reporter.submit(oldest);
		await vi.waitFor(() => expect(client.calls).toHaveLength(1));

		reporter.submit(middle);
		reporter.submit(newest);
		client.settle();

		await vi.waitFor(() => expect(client.calls).toEqual([oldest, newest]));
		reporter.close();
	});

	it('discards the client on disconnect and resends the whole table after reconnecting', async () => {
		const first = fakeClient();
		const second = fakeClient();
		const connect = vi
			.fn<() => Promise<typeof first>>()
			.mockResolvedValueOnce(first)
			.mockResolvedValueOnce(second);
		const reporter = createDevframeReporter(endpoint, {
			connect,
			reconnectDelayMs: 0
		});
		await vi.waitFor(() => expect(first.handlerCount).toBe(1));
		first.emit('connected');

		const rows: PageRuntimeRow[] = [{ runtimeId: 1, injections: [], diagnostics: [] }];
		reporter.submit(rows);
		await vi.waitFor(() => expect(first.calls).toEqual([rows]));
		first.settle();

		first.emit('disconnected');
		expect(first.close).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
		expect(second.calls).toHaveLength(0);

		second.emit('connected');
		await vi.waitFor(() => expect(second.calls).toEqual([rows]));
		reporter.close();
	});

	it('does not reconnect after close', async () => {
		const client = fakeClient();
		const connect = vi.fn(async () => client);
		const reporter = createDevframeReporter(endpoint, {
			connect,
			reconnectDelayMs: 0
		});
		await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce());
		client.emit('connected');

		reporter.close();
		client.emit('disconnected');
		await settled();

		expect(connect).toHaveBeenCalledOnce();
		expect(client.close).toHaveBeenCalledOnce();
	});
});
