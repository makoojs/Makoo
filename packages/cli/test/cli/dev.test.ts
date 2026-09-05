import type { Logger, ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevSession } from '../../src/session/DevSession';
import { devCommand } from '../../src/cli/commands/dev/dev';
import { bindDevSession, type InlineConfigWithSession } from '../../src/vite/makooDev';

vi.mock('vite', () => ({
	createServer: vi.fn()
}));

vi.mock('../../src/cli/version', () => ({
	loadCliVersion: vi.fn().mockResolvedValue('0.4.1')
}));

function createLogger(): Logger & { printedInfo: ReturnType<typeof vi.fn> } {
	const info = vi.fn();
	return {
		info,
		warn: vi.fn(),
		warnOnce: vi.fn(),
		error: vi.fn(),
		clearScreen: vi.fn(),
		hasErrorLogged: vi.fn(() => false),
		hasWarned: false,
		printedInfo: info
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('devCommand', () => {
	it('subscribes to the DevSession and binds inspector shortcuts', async () => {
		const { createServer } = await import('vite');
		const logger = createLogger();
		const bindCLIShortcuts = vi.fn();
		const session = new DevSession();
		const subscribe = vi.spyOn(session, 'subscribe');
		const server = {
			config: {
				logger,
				inlineConfig: {},
				plugins: [{ name: 'makoo:dev', api: { session } }]
			},
			listen: vi.fn(),
			close: vi.fn(),
			resolvedUrls: {
				local: ['http://localhost:5174/'],
				network: []
			},
			bindCLIShortcuts
		} as unknown as ViteDevServer;
		vi.mocked(createServer).mockResolvedValue(server);
		vi.spyOn(process, 'once').mockImplementation(() => process);

		await devCommand();

		expect(server.listen).toHaveBeenCalledOnce();
		expect(server.config.inlineConfig.customLogger).toBe(logger);
		expect((server.config.inlineConfig as InlineConfigWithSession)[bindDevSession]).toBeTypeOf(
			'function'
		);
		expect(subscribe).toHaveBeenCalledOnce();
		expect(bindCLIShortcuts).toHaveBeenCalledWith({
			print: true,
			customShortcuts: [
				expect.objectContaining({
					key: 't',
					description: 'toggle Runtime tasks'
				})
			]
		});
		expect(logger.printedInfo).toHaveBeenCalledWith(
			expect.stringContaining('Makoo v0.4.1'),
			undefined
		);
	});

	it('keeps the ordinary dev server unchanged when makooDev is not configured', async () => {
		const { createServer } = await import('vite');
		const logger = createLogger();
		const bindCLIShortcuts = vi.fn();
		const server = {
			config: { logger, inlineConfig: {}, plugins: [] },
			listen: vi.fn(),
			close: vi.fn(),
			resolvedUrls: {
				local: ['http://localhost:5173/'],
				network: []
			},
			bindCLIShortcuts
		} as unknown as ViteDevServer;
		vi.mocked(createServer).mockResolvedValue(server);
		vi.spyOn(process, 'once').mockImplementation(() => process);

		await devCommand();

		expect((server.config.inlineConfig as InlineConfigWithSession)[bindDevSession]).toBeUndefined();
		expect(bindCLIShortcuts).toHaveBeenCalledWith({
			print: true
		});
	});
});
