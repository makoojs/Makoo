import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../src/logger/Logger';

describe('Logger', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('exposes and updates the current log level', () => {
		const logger = new Logger();

		expect(logger.getLevel()).toBe('info');

		logger.setLevel('debug');

		expect(logger.getLevel()).toBe('debug');
	});

	it('filters messages below the configured level', () => {
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const logger = new Logger('warn');

		logger.info('hidden');

		expect(infoSpy).not.toHaveBeenCalled();
	});

	it('writes formatted messages for enabled log levels', () => {
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const logger = new Logger('debug');

		logger.debug('visible', { id: 1 });

		expect(debugSpy).toHaveBeenCalledWith(
			expect.stringMatching(/^\[Makoo\]\[DEBUG\]\[[^\]]+\] visible$/),
			{ id: 1 }
		);
	});

	it('returns early when an invalid logger level is encountered', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const logger = new Logger('info');

		logger.log('fatal' as never, 'no-op');
		logger.setLevel('fatal' as never);
		logger.error('still no-op');

		expect(errorSpy).not.toHaveBeenCalled();
	});
});
