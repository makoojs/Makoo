import { PassThrough } from 'node:stream';
import type { Logger, ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { PageRuntimeRow } from '../../src/bridge/protocol';
import { RuntimeStore } from '../../src/bridge/store';
import { DevTerminal } from '../../src/tui/DevTerminal';

const row = (runtimeId: number): PageRuntimeRow => ({
	runtimeId,
	injections: [],
	diagnostics: []
});

const { clear, render } = vi.hoisted(() => ({
	clear: vi.fn(),
	render: vi.fn()
}));
vi.mock('log-update', () => ({
	createLogUpdate: vi.fn(() => Object.assign(render, { clear }))
}));
vi.mock('../../src/commands/version', () => ({
	loadCliVersion: vi.fn(async () => '0.4.1')
}));

let input: PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: ReturnType<typeof vi.fn> };
let output: PassThrough & { isTTY: boolean };
let info: Mock<Logger['info']>;
let error: Mock<Logger['error']>;
let warn: Mock<Logger['warn']>;
let logger: Logger;
let store: RuntimeStore;
let server: ViteDevServer;
let terminal: DevTerminal;

beforeEach(() => {
	input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, setRawMode: vi.fn() });
	output = Object.assign(new PassThrough(), { isTTY: true });
	vi.spyOn(process, 'stdin', 'get').mockReturnValue(input as unknown as typeof process.stdin);
	vi.spyOn(process, 'stdout', 'get').mockReturnValue(output as unknown as typeof process.stdout);
	vi.stubEnv('CI', '');
	info = vi.fn<Logger['info']>();
	error = vi.fn<Logger['error']>();
	warn = vi.fn<Logger['warn']>();
	logger = {
		info,
		error,
		warn,
		warnOnce: vi.fn(),
		clearScreen: vi.fn(),
		hasWarned: false,
		hasErrorLogged: vi.fn(() => false)
	};
	store = new RuntimeStore();
	server = {
		config: {
			logger,
			base: '/app/',
			server: { open: '/custom' },
			inlineConfig: {},
			plugins: [{ name: 'makoo:dev' }, { name: 'monkey:virtualHtml' }]
		},
		listen: vi.fn(),
		close: vi.fn(),
		restart: vi.fn(),
		openBrowser: vi.fn(),
		bindCLIShortcuts: vi.fn(),
		resolvedUrls: { local: ['http://localhost:5174/'], network: [] }
	} as unknown as ViteDevServer;
	terminal = new DevTerminal(server, store);
});

async function start() {
	await server.listen();
	await terminal.showHome();
	terminal.activate();
}

afterEach(() => {
	terminal.close();
	input.destroy();
	output.destroy();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

describe('DevTerminal', () => {
	it('recovers from a failed restart and accepts the next shortcut', async () => {
		await start();
		vi.mocked(server.restart).mockRejectedValue(new Error('restart failed'));
		input.write('r');
		await vi.waitFor(() =>
			expect(String(render.mock.calls.at(-1)?.[0])).toContain('1 new · 1 error')
		);
		expect(String(render.mock.calls.at(-1)?.[0])).not.toContain('Restarting…');
		input.write('l');
		expect(error).toHaveBeenCalledWith('[makoo] restart failed', undefined);
	});

	it('ignores repeated shortcuts while restarting and still handles Ctrl+C', async () => {
		await start();
		let finish!: () => void;
		vi.mocked(server.restart).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
		input.write('rr');
		expect(server.restart).toHaveBeenCalledOnce();
		input.write('\x03');
		await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
		expect(server.close).toHaveBeenCalledOnce();
		expect(input.setRawMode).toHaveBeenLastCalledWith(false);
		finish();
		await Promise.resolve();
	});

	it('reports omitted logs and flushes only the retained messages', async () => {
		await start();
		for (let i = 0; i < 1001; i += 1) logger.info(`log-${i}`);
		input.write('l');
		expect(warn).toHaveBeenCalledWith('[makoo] 1 earlier dev logs omitted.');
		expect(info).not.toHaveBeenCalledWith('log-0', undefined);
		expect(info).toHaveBeenCalledWith('log-1', undefined);
		expect(info).toHaveBeenCalledWith('log-1000', undefined);
	});
	it('draws current session data on the home without printing connection logs', async () => {
		await start();
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Makoo v0.4.1');
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Waiting for a browser runtime');
		store.replacePage(1, [row(1), row(2)]);
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('2 browser runtimes connected');
		store.disconnect(1);
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Waiting for a browser runtime');
		expect(info).not.toHaveBeenCalled();
		expect(server.bindCLIShortcuts).not.toHaveBeenCalled();
	});

	it('buffers logs and errors until l opens the logs, then returns home with l', async () => {
		await start();
		logger.info('compile finished', { clear: true });
		logger.error('compile failed', { clear: true });
		expect(info).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('2 new · 1 error');
		input.write('l');
		await Promise.resolve();
		expect(info).toHaveBeenCalledWith('compile finished', { clear: false });
		expect(error).toHaveBeenCalledWith('compile failed', { clear: false });
		input.write('l');
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('0 new');
	});

	it('selects runtimes with n and keeps the selection in range after disconnect', async () => {
		await start();
		store.replacePage(1, [row(1)]);
		store.replacePage(2, [row(1)]);
		input.write('t');
		await Promise.resolve();
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Runtime 1/2');
		input.write('n');
		await Promise.resolve();
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Runtime 2/2');
		store.disconnect(2);
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Runtime 1/1');
		input.write('t');
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Actions');
	});

	it.each([
		{ from: 'home' as const, key: 'h', expected: 'Actions' },
		{ from: 'home' as const, key: '\x1b', expected: 'Actions' },
		{ from: 'injections' as const, key: 'h', expected: 'Makoo Injections' },
		{ from: 'injections' as const, key: '\x1b', expected: 'Makoo Injections' },
		{ from: 'logs' as const, key: 'h', expected: '' },
		{ from: 'logs' as const, key: '\x1b', expected: '' }
	])('returns from help to $from using $key', async ({ from, key, expected }) => {
		await start();
		terminal.show(from);
		input.write('h');
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Press h or Esc to return.');
		logger.info('hidden log');
		const write = vi.spyOn(output, 'write');
		write.mockClear();
		render.mockClear();
		input.write(key);
		if (from === 'logs') {
			await vi.waitFor(() => expect(write).toHaveBeenCalledWith('\x1B[?1049l'));
			expect(info).toHaveBeenCalledWith('hidden log', undefined);
		} else {
			await vi.waitFor(() =>
				expect(String(render.mock.calls.at(-1)?.[0])).toContain(expected)
			);
			expect(write).not.toHaveBeenCalledWith('\x1B[?1049l');
			expect(info).not.toHaveBeenCalled();
		}
	});

	it('restarts on the home and keeps listening to its store', async () => {
		await start();
		vi.mocked(server.restart).mockImplementation(async () => {
			expect(String(render.mock.calls.at(-1)?.[0])).toContain('Restarting…');
			server.resolvedUrls = { local: ['http://localhost:5175/'], network: [] };
			logger.info('server restarted');
		});
		input.write('r');
		await vi.waitFor(() =>
			expect(String(render.mock.calls.at(-1)?.[0])).not.toContain('Restarting…')
		);
		expect(server.restart).toHaveBeenCalledOnce();
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('http://localhost:5175/');
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('Open installation page');
		render.mockClear();
		store.replacePage(1, [row(1)]);
		expect(String(render.mock.calls.at(-1)?.[0])).toContain('1 browser runtime connected');
	});

	it('opens the installation page without replacing the configured open path', async () => {
		await start();
		vi.mocked(server.openBrowser).mockImplementation(() => {
			expect(server.config.server.open).toBe('/app/');
		});
		input.write('i');
		expect(server.openBrowser).toHaveBeenCalledOnce();
		expect(server.config.server.open).toBe('/custom');
	});

	it('prints connection changes and streams logs when output is not interactive', async () => {
		terminal.close();
		output.isTTY = false;
		terminal = new DevTerminal(server, store);
		await start();
		store.replacePage(1, [row(1)]);
		expect(info).toHaveBeenLastCalledWith(
			expect.stringContaining('1 browser runtime connected'),
			undefined
		);
		info.mockClear();
		store.replacePage(1, [row(1)]);
		expect(info).not.toHaveBeenCalled();
		logger.info('build output');
		expect(info).toHaveBeenLastCalledWith('build output', undefined);
		expect(render).not.toHaveBeenCalled();
		expect(input.setRawMode).not.toHaveBeenCalled();
	});

	it('restores terminal input and logging and unsubscribes on close', async () => {
		await start();
		logger.info('buffered log');
		terminal.close();
		expect(logger.info).toBe(info);
		expect(input.setRawMode).toHaveBeenLastCalledWith(false);
		expect(info).toHaveBeenCalledWith('buffered log', undefined);
		expect(input.listenerCount('keypress')).toBe(0);
		render.mockClear();
		store.replacePage(1, [row(1)]);
		expect(render).not.toHaveBeenCalled();
	});
});
