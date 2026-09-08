import { emitKeypressEvents, type Key } from 'node:readline';
import { createLogUpdate } from 'log-update';
import type { LogErrorOptions, Logger, LogOptions, ViteDevServer } from 'vite';
import type { DevSession } from '../../../session/DevSession';
import type { RuntimeSnapshot } from '../../../session/types';
import { bindDevSession, type InlineConfigWithSession } from '../../../vite/makooDev';
import { renderTasksTable } from '../../tasks/renderTasks';
import { ansi, colorize } from '../../terminalColor';

const ENTER_ALT_SCREEN = '\x1B[?1049h';
const LEAVE_ALT_SCREEN = '\x1B[?1049l';
const MAX_BUFFERED_LOGS = 1000;

type DevView = 'home' | 'tasks' | 'help' | 'logs';
type BufferedLog =
	| { type: 'info' | 'warn' | 'warnOnce'; message: string; options?: LogOptions }
	| { type: 'error'; message: string; options?: LogErrorOptions };

export class DevTerminal {
	public readonly interactive = Boolean(
		process.stdin.isTTY && process.stdout.isTTY && !process.env.CI
	);
	private session: DevSession | undefined;
	private unsubscribe: (() => void) | undefined;
	private currentView: DevView = 'logs';
	private previousView: DevView = 'home';
	private selectedRuntime = 0;
	private runtimeCount = -1;
	private ready = false;
	private restarting = false;
	private actionRunning = false;
	private closed = false;
	private stopInput: (() => void) | undefined;
	private bufferedLogs: BufferedLog[] = [];
	private omittedLogs = 0;
	private unreadErrors = 0;
	private readonly screenOutput = createLogUpdate(process.stdout, { showCursor: true });
	public readonly logger: Logger;
	private readonly originalInfo: Logger['info'];
	private readonly originalWarn: Logger['warn'];
	private readonly originalWarnOnce: Logger['warnOnce'];
	private readonly originalError: Logger['error'];
	private readonly originalClearScreen: Logger['clearScreen'];

	public constructor(
		private readonly server: ViteDevServer,
		private readonly cliVersion: string
	) {
		this.session = server.config.plugins.find(
			(plugin) => plugin.name === 'makoo:dev'
		)?.api?.session;
		this.logger = server.config.logger;
		this.originalInfo = this.logger.info;
		this.originalWarn = this.logger.warn;
		this.originalWarnOnce = this.logger.warnOnce;
		this.originalError = this.logger.error;
		this.originalClearScreen = this.logger.clearScreen;

		this.logger.info = (message, options) => this.writeLog({ type: 'info', message, options });
		this.logger.warn = (message, options) => this.writeLog({ type: 'warn', message, options });
		this.logger.warnOnce = (message, options) =>
			this.writeLog({ type: 'warnOnce', message, options });
		this.logger.error = (message, options) =>
			this.writeLog({ type: 'error', message, options });
		this.logger.clearScreen = (type) => {
			if (this.currentView === 'logs') this.originalClearScreen.call(this.logger, type);
		};
	}

	public async start(): Promise<void> {
		process.once('exit', this.close);
		if (this.session) {
			// Vite reuses inlineConfig when a restart creates the next server.
			this.server.config.inlineConfig.customLogger = this.logger;
			(this.server.config.inlineConfig as InlineConfigWithSession)[bindDevSession] =
				this.attachSession;
			this.attachSession(this.session);
			process.once('SIGINT', this.shutdown);
		}

		try {
			await this.server.listen();
			this.ready = true;
			if (!this.session) {
				this.logger.info(this.renderBanner());
				this.server.bindCLIShortcuts({ print: true });
				return;
			}
			if (this.interactive) {
				this.show('home');
				this.bindShortcuts();
			} else {
				const runtimes = this.session.getTasks();
				this.runtimeCount = runtimes.length;
				this.logger.info(this.renderHome(runtimes));
			}
		} catch (error) {
			this.close();
			await this.server.close();
			throw error;
		}
	}

	public attachSession = (session: DevSession): void => {
		this.unsubscribe?.();
		this.session = session;
		this.selectedRuntime = 0;
		// New session subscription refresh method
		this.unsubscribe = session.subscribe(this.refresh);
		this.refresh();
	};

	// Session events, navigation and new logs all redraw through this entry point.
	public refresh = (): void => {
		if (!this.ready || this.closed || !this.session) return;
		const runtimes = this.session.getTasks();
		this.selectedRuntime = runtimes.length === 0 ? 0 : this.selectedRuntime % runtimes.length;
		if (!this.interactive) {
			if (this.runtimeCount !== runtimes.length) {
				this.runtimeCount = runtimes.length;
				this.logger.info(`  Runtime   ${this.renderRuntimeStatus(runtimes.length)}`);
			}
			return;
		}
		switch (this.currentView) {
			case 'home':
				this.draw(
					this.renderHome(runtimes),
					'Press a key to select an action. Press Ctrl+C to stop.'
				);
				break;
			case 'tasks':
				this.draw(
					this.renderTasks(runtimes),
					'Press t or Esc to return home. Press Ctrl+C to stop.'
				);
				break;
			case 'help':
				this.draw(this.renderHelp(), 'Press h or Esc to return. Press Ctrl+C to stop.');
				break;
			case 'logs':
				break;
		}
	};

	public show(view: DevView): void {
		if (this.closed || !this.interactive) return;
		const previous = this.currentView;
		this.currentView = view;
		if (previous === 'logs' && view !== 'logs') process.stdout.write(ENTER_ALT_SCREEN);
		// last screen is not 'logs' and now view is  'logs', switch to common screen and write logs
		if (previous !== 'logs' && view === 'logs') {
			// clear the screen
			this.screenOutput.clear();
			process.stdout.write(LEAVE_ALT_SCREEN);
			this.flushLogs();
			this.originalInfo.call(
				this.logger,
				colorize('Press l or Esc to return home. Press Ctrl+C to stop.', ansi.dim)
			);
		}
		// print something
		this.refresh();
	}

	private renderBanner(): string {
		const urls = this.server.resolvedUrls;
		return [
			`\n  ${colorize('◆', ansi.deepPink)} ${colorize(`Makoo v${this.cliVersion}`, ansi.bold, ansi.cyan)}  ${colorize('dev', ansi.dim)}\n`,
			`  ${colorize('Local', ansi.dim)}     ${colorize(urls?.local[0] ?? 'unavailable', ansi.cyan)}`,
			`  ${colorize('Network', ansi.dim)}   ${urls?.network[0] ?? colorize('use --host to expose', ansi.dim)}`
		].join('\n');
	}

	private renderRuntimeStatus(count: number): string {
		if (this.restarting) return 'Restarting…';
		if (count === 0) return 'Waiting for a browser runtime';
		return `${count} browser runtime${count === 1 ? '' : 's'} connected`;
	}

	private renderHome(runtimes: RuntimeSnapshot[]): string {
		const waiting = this.restarting || runtimes.length === 0;
		const total = this.bufferedLogs.length + this.omittedLogs;
		const logs = `${total} new${this.unreadErrors ? ` · ${this.unreadErrors} error${this.unreadErrors === 1 ? '' : 's'}` : ''}`;
		return [
			this.renderBanner(),
			`  ${colorize('Runtime', ansi.dim)}   ${colorize(waiting ? '○' : '●', waiting ? ansi.yellow : ansi.green)} ${this.renderRuntimeStatus(runtimes.length)}`,
			`  ${colorize('Logs', ansi.dim)}      ${colorize(logs, this.unreadErrors ? ansi.red : ansi.dim)}`,
			`\n  ${colorize('Actions', ansi.bold)}`,
			...(this.hasInstallationPage()
				? [`  ${colorize('i', ansi.bold, ansi.cyan)}  Open installation page`]
				: []),
			`  ${colorize('t', ansi.bold, ansi.cyan)}  View runtime tasks`,
			`  ${colorize('l', ansi.bold, ansi.cyan)}  View logs`,
			`  ${colorize('r', ansi.bold, ansi.cyan)}  Restart server`,
			`  ${colorize('h', ansi.bold, ansi.cyan)}  Show help`
		].join('\n');
	}

	private renderTasks(runtimes: RuntimeSnapshot[]): string {
		if (runtimes.length === 0) return 'Makoo Tasks\n\nWaiting for a browser runtime';
		const runtime = runtimes[this.selectedRuntime];
		return [
			`Runtime ${this.selectedRuntime + 1}/${runtimes.length} · Client ${runtime.clientId} · Makoo${runtime.runtimeId}`,
			renderTasksTable([runtime]),
			...(runtimes.length > 1 ? ['Press n to view the next runtime.'] : [])
		].join('\n\n');
	}

	private renderHelp(): string {
		return [
			colorize('Shortcuts', ansi.bold),
			'',
			...(this.hasInstallationPage()
				? [
						`  ${colorize('i', ansi.bold, ansi.cyan)}  open development script installation page`
					]
				: []),
			...[
				['t', 'toggle Runtime tasks'],
				['n', 'view next runtime tasks'],
				['l', 'view logs / return home'],
				['r', 'restart the server'],
				['u', 'show server URLs'],
				['o', 'open in browser'],
				['c', 'clear console'],
				['q', 'quit'],
				['h', 'show help']
			].map(
				([key, description]) => `  ${colorize(key, ansi.bold, ansi.cyan)}  ${description}`
			)
		].join('\n');
	}

	private draw(content: string, hint: string): void {
		const lines = [content, ''];
		const total = this.bufferedLogs.length + this.omittedLogs;
		if (total > 0 && this.currentView !== 'home') {
			const status = `${total} new dev log${total === 1 ? '' : 's'}`;
			const errors =
				this.unreadErrors > 0
					? ` · ${this.unreadErrors} error${this.unreadErrors === 1 ? '' : 's'}`
					: '';
			lines.push(colorize(status + errors, this.unreadErrors ? ansi.red : ansi.dim));
		}
		lines.push(colorize(hint, ansi.dim));
		this.screenOutput(lines.join('\n'));
	}

	private hasInstallationPage(): boolean {
		// Check for plugins that redirect to the installation page.
		return this.server.config.plugins.some((plugin) => plugin.name === 'monkey:virtualHtml');
	}

	private bindShortcuts(): void {
		const wasRaw = process.stdin.isRaw;
		const wasFlowing = process.stdin.readableFlowing;
		emitKeypressEvents(process.stdin);
		process.stdin.setRawMode(true);
		process.stdin.on('keypress', this.onKey);
		process.stdin.resume();
		this.stopInput = () => {
			process.stdin.off('keypress', this.onKey);
			process.stdin.setRawMode(wasRaw);
			if (!wasFlowing) process.stdin.pause();
		};
	}

	private onKey = async (_text: string, key: Key): Promise<void> => {
		if (key.ctrl && key.name === 'c') {
			await this.shutdown();
			return;
		}
		if (this.actionRunning || key.ctrl) return;
		if (key.name === 'escape') {
			this.show(this.currentView === 'help' ? this.previousView : 'home');
			return;
		}
		if (key.meta || key.sequence?.length !== 1) return;
		if (key.name === 'h') {
			if (this.currentView === 'help') this.show(this.previousView);
			else {
				this.previousView = this.currentView;
				this.show('help');
			}
			return;
		}
		// Ignore unknown keys without leaving help.
		if (!['i', 't', 'n', 'l', 'r', 'u', 'o', 'c', 'q'].includes(key.name ?? '')) return;
		if (key.name === 'i' && !this.hasInstallationPage()) return;
		if (this.currentView === 'help') this.show(this.previousView);
		this.actionRunning = true;
		try {
			switch (key.name) {
				case 't':
					this.show(this.currentView === 'tasks' ? 'home' : 'tasks');
					break;
				case 'n':
					this.selectedRuntime += 1;
					this.show('tasks');
					break;
				case 'l':
					this.show(this.currentView === 'logs' ? 'home' : 'logs');
					break;
				case 'r':
					await this.restart();
					break;
				case 'u':
					this.show('home');
					break;
				case 'o':
					this.server.openBrowser();
					break;
				case 'i':
					this.openInstallationPage();
					break;
				case 'c':
					this.show('logs');
					this.logger.clearScreen('error');
					break;
				case 'q':
					await this.shutdown();
					break;
			}
		} catch (error) {
			this.logger.error(`[makoo] ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.actionRunning = false;
		}
	};

	private openInstallationPage(): void {
		const open = this.server.config.server.open;
		try {
			this.server.config.server.open = this.server.config.base;
			this.server.openBrowser();
		} finally {
			this.server.config.server.open = open;
		}
	}

	private async restart(): Promise<void> {
		this.restarting = true;
		this.show('home');
		try {
			await this.server.restart();
		} finally {
			this.restarting = false;
			this.refresh();
		}
	}

	private shutdown = async (): Promise<void> => {
		this.close();
		try {
			await this.server.close();
		} finally {
			process.exit(0);
		}
	};

	public close = (): void => {
		if (this.closed) return;
		this.closed = true;
		this.unsubscribe?.();
		this.stopInput?.();
		process.off('exit', this.close);
		process.off('SIGINT', this.shutdown);
		if (this.currentView !== 'logs') {
			this.screenOutput.clear();
			process.stdout.write(LEAVE_ALT_SCREEN);
			this.currentView = 'logs';
			this.flushLogs();
		}
		this.logger.info = this.originalInfo;
		this.logger.warn = this.originalWarn;
		this.logger.warnOnce = this.originalWarnOnce;
		this.logger.error = this.originalError;
		this.logger.clearScreen = this.originalClearScreen;
	};

	private writeLog(log: BufferedLog): void {
		if (this.currentView === 'logs') {
			this.printLog(log);
			return;
		}
		if (log.type === 'error') this.unreadErrors += 1;
		if (log.options) log.options = { ...log.options, clear: false };
		this.bufferedLogs.push(log);
		if (this.bufferedLogs.length > MAX_BUFFERED_LOGS) {
			this.bufferedLogs.shift();
			this.omittedLogs += 1;
		}
		this.refresh();
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
		if (this.omittedLogs > 0)
			this.originalWarn.call(
				this.logger,
				`[makoo] ${this.omittedLogs} earlier dev logs omitted.`
			);
		for (const log of this.bufferedLogs) this.printLog(log);
		this.bufferedLogs = [];
		this.omittedLogs = 0;
		this.unreadErrors = 0;
	}
}
