import { createLogUpdate } from 'log-update';
import type { LogErrorOptions, Logger, LogOptions } from 'vite';
import { ansi, colorize } from '../../terminalColor';

// Enter the terminal's alternate screen so the current view does not overwrite the dev logs.
const ENTER_ALT_SCREEN = '\x1B[?1049h';
// Leave the alternate screen and restore the dev logs.
const LEAVE_ALT_SCREEN = '\x1B[?1049l';
const MAX_BUFFERED_LOGS = 1000;

export type DevScreen = {
	key: string;
	description: string;
	render: () => string;
};

type BufferedLog =
	| { type: 'info'; message: string; options?: LogOptions }
	| { type: 'warn'; message: string; options?: LogOptions }
	| { type: 'warnOnce'; message: string; options?: LogOptions }
	| { type: 'error'; message: string; options?: LogErrorOptions };

export class DevTerminal {
	private screen: DevScreen | null = null;
	private bufferedLogs: BufferedLog[] = [];
	private omittedLogs = 0;
	private unreadErrors = 0;
	private closed = false;
	private readonly screenOutput: ReturnType<typeof createLogUpdate>;
	private readonly originalInfo: Logger['info'];
	private readonly originalWarn: Logger['warn'];
	private readonly originalWarnOnce: Logger['warnOnce'];
	private readonly originalError: Logger['error'];
	private readonly originalClearScreen: Logger['clearScreen'];

	public constructor(public readonly logger: Logger) {
		this.screenOutput = createLogUpdate(process.stdout, { showCursor: true });
		this.originalInfo = logger.info;
		this.originalWarn = logger.warn;
		this.originalWarnOnce = logger.warnOnce;
		this.originalError = logger.error;
		this.originalClearScreen = logger.clearScreen;

		logger.info = (message, options) => this.writeLog({ type: 'info', message, options });
		logger.warn = (message, options) => this.writeLog({ type: 'warn', message, options });
		logger.warnOnce = (message, options) =>
			this.writeLog({ type: 'warnOnce', message, options });
		logger.error = (message, options) => this.writeLog({ type: 'error', message, options });
		logger.clearScreen = (type) => {
			if (this.screen === null) this.originalClearScreen.call(this.logger, type);
		};
	}

	public toggle(screen: DevScreen): void {
		if (this.screen === screen) {
			this.showLogs();
			return;
		}
		this.show(screen);
	}

	public show(screen: DevScreen): void {
		if (this.closed || this.screen === screen) return;
		const isLogs = this.screen === null;
		this.screen = screen;
		if (isLogs) process.stdout.write(ENTER_ALT_SCREEN);
		this.render();
	}

	public showLogs(): void {
		if (this.closed || this.screen === null) return;
		this.screenOutput.clear();
		process.stdout.write(LEAVE_ALT_SCREEN);
		this.screen = null;
		this.flushLogs();
	}

	public refresh(screen: DevScreen): void {
		if (this.screen === screen) this.render();
	}

	public close(): void {
		if (this.closed) return;
		if (this.screen !== null) this.showLogs();

		this.logger.info = this.originalInfo;
		this.logger.warn = this.originalWarn;
		this.logger.warnOnce = this.originalWarnOnce;
		this.logger.error = this.originalError;
		this.logger.clearScreen = this.originalClearScreen;
		this.closed = true;
	}

	private writeLog(log: BufferedLog): void {
		if (this.screen === null) {
			this.printLog(log);
			return;
		}

		if (log.type === 'error') {
			this.unreadErrors += 1;
		}
		if (log.options) {
			log.options = { ...log.options, clear: false };
		}
		this.bufferedLogs.push(log);
		if (this.bufferedLogs.length > MAX_BUFFERED_LOGS) {
			this.bufferedLogs.shift();
			this.omittedLogs += 1;
		}
		this.render();
	}

	private printLog(log: BufferedLog): void {
		switch (log.type) {
			case 'info':
				this.originalInfo.call(this.logger, log.message, log.options);
				break;
			case 'warn':
				this.originalWarn.call(this.logger, log.message, log.options);
				break;
			case 'warnOnce':
				this.originalWarnOnce.call(this.logger, log.message, log.options);
				break;
			case 'error':
				this.originalError.call(this.logger, log.message, log.options);
				break;
		}
	}

	private flushLogs(): void {
		if (this.omittedLogs > 0) {
			this.originalWarn.call(
				this.logger,
				`[makoo] ${this.omittedLogs} earlier dev logs omitted.`
			);
		}
		for (const log of this.bufferedLogs) this.printLog(log);
		this.bufferedLogs = [];
		this.omittedLogs = 0;
		this.unreadErrors = 0;
	}

	private render(): void {
		if (!this.screen) return;
		const totalLogs = this.bufferedLogs.length + this.omittedLogs;
		const lines = [this.screen.render(), ''];
		if (totalLogs > 0) {
			let status = `${totalLogs} new dev logs`;
			if (totalLogs === 1) status = '1 new dev log';

			if (this.unreadErrors > 0) {
				let errors = `${this.unreadErrors} errors`;
				if (this.unreadErrors === 1) errors = '1 error';
				lines.push(colorize(`${status} · ${errors}`, ansi.red));
			} else {
				lines.push(colorize(status, ansi.dim));
			}
		}
		lines.push(
			colorize(
				`Press ${this.screen.key} + enter to return to logs. Press Ctrl+C to stop.`,
				ansi.dim
			)
		);

		this.screenOutput(lines.join('\n'));
	}
}
