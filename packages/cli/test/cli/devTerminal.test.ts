import type { Logger } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DevScreen, DevTerminal } from '../../src/cli/commands/dev/DevTerminal';
import { ansi } from '../../src/cli/terminalColor';

const { clear, render } = vi.hoisted(() => ({
	clear: vi.fn(),
	render: vi.fn()
}));

vi.mock('log-update', () => ({
	createLogUpdate: vi.fn(() => Object.assign(render, { clear }))
}));

function createLogger(): Logger & {
	printed: {
		info: ReturnType<typeof vi.fn>;
		warn: ReturnType<typeof vi.fn>;
		error: ReturnType<typeof vi.fn>;
	};
} {
	const info = vi.fn();
	const warn = vi.fn();
	const warnOnce = vi.fn();
	const error = vi.fn();
	return {
		info,
		warn,
		warnOnce,
		error,
		clearScreen: vi.fn(),
		hasErrorLogged: vi.fn(() => false),
		hasWarned: false,
		printed: { info, warn, error }
	};
}

function removeColor(value: string): string {
	for (const code of Object.values(ansi)) value = value.replaceAll(code, '');
	return value;
}

function createScreen(key: string, body: () => string): DevScreen {
	return {
		key,
		description: `toggle ${key}`,
		render: body
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	clear.mockClear();
	render.mockClear();
});

describe('DevTerminal', () => {
	it('switches between the dev log screen and a custom screen', () => {
		const logger = createLogger();
		const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const terminal = new DevTerminal(logger);
		let body = 'waiting';
		const screen = createScreen('t', () => body);

		logger.info('server ready');
		expect(logger.printed.info).toHaveBeenCalledWith('server ready', undefined);

		terminal.show(screen);
		expect(write).toHaveBeenCalledWith('\x1B[?1049h');
		expect(removeColor(String(render.mock.calls.at(-1)?.[0]))).toContain(
			'Press t + enter to return to logs.'
		);

		body = 'danmaku-panel';
		terminal.refresh(screen);
		expect(removeColor(String(render.mock.calls.at(-1)?.[0]))).toContain('danmaku-panel');

		const error = new Error('build failed');
		logger.info('hidden update', { clear: true });
		logger.error('build failed', { error, clear: true });
		expect(logger.printed.info).toHaveBeenCalledTimes(1);
		expect(logger.printed.error).not.toHaveBeenCalled();
		expect(removeColor(String(render.mock.calls.at(-1)?.[0]))).toContain(
			'2 new dev logs · 1 error'
		);

		terminal.showLogs();
		expect(write).toHaveBeenLastCalledWith('\x1B[?1049l');
		expect(logger.printed.info).toHaveBeenLastCalledWith('hidden update', { clear: false });
		expect(logger.printed.error).toHaveBeenCalledWith('build failed', {
			error,
			clear: false
		});

		terminal.close();
	});

	it('switches screens without leaving the alternate screen', () => {
		const logger = createLogger();
		const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const terminal = new DevTerminal(logger);
		const tasks = createScreen('t', () => 'tasks');
		const logs = createScreen('l', () => 'session logs');

		terminal.show(tasks);
		write.mockClear();
		terminal.show(logs);

		expect(write).not.toHaveBeenCalled();
		expect(removeColor(String(render.mock.calls.at(-1)?.[0]))).toContain('session logs');
		expect(removeColor(String(render.mock.calls.at(-1)?.[0]))).toContain(
			'Press l + enter to return to logs.'
		);

		terminal.toggle(logs);
		expect(write).toHaveBeenCalledWith('\x1B[?1049l');

		terminal.close();
	});

	it('restores the original logger and alternate screen when closed', () => {
		const logger = createLogger();
		const originalInfo = logger.info;
		const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const terminal = new DevTerminal(logger);

		terminal.show(createScreen('t', () => 'tasks'));
		terminal.close();

		expect(logger.info).toBe(originalInfo);
		expect(write).toHaveBeenLastCalledWith('\x1B[?1049l');
	});
});
