import { createServer, type Logger, type ViteDevServer } from 'vite';
import type { DevSession } from '../../../session/DevSession';
import { bindDevSession, type InlineConfigWithSession } from '../../../vite/makooDev';
import { renderTasksTable } from '../../tasks/renderTasks';
import { ansi, colorize } from '../../terminalColor';
import { loadCliVersion } from '../../version';
import { type DevScreen, DevTerminal } from './DevTerminal';

const cliVersionCache: string | null = null;

async function showDevBanner(server: ViteDevServer, logger: Logger): Promise<void> {
	const cliVersion = await loadCliVersion(cliVersionCache);
	const title = `Makoo v${cliVersion}`;
	const urls = server.resolvedUrls;
	const localUrl = urls?.local[0];
	const networkUrl = urls?.network[0];

	logger.info(`\n${colorize(title, ansi.bold, ansi.cyan)}\n`);
	logger.info(
		`  ${colorize('➜', ansi.green)}  ${colorize('Local:', ansi.bold)}   ${colorize(localUrl ?? 'unavailable', ansi.cyan)}`
	);
	logger.info(
		`  ${colorize('➜', ansi.green)}  ${colorize('Network:', ansi.bold)} ${networkUrl ?? colorize('use --host to expose', ansi.dim)}`
	);
}
function getDevSession(server: ViteDevServer): DevSession | undefined {
	const plugin = server.config.plugins.find((plugin) => plugin.name === 'makoo:dev');
	return plugin?.api?.session;
}
export async function devCommand(): Promise<void> {
	const server = await createServer();
	const viteLogger = server.config.logger;
	const initialSession = getDevSession(server);
	if (!initialSession) {
		await server.listen();
		await showDevBanner(server, viteLogger);
		server.bindCLIShortcuts({ print: true });
		return;
	}

	const terminal = new DevTerminal(viteLogger);
	let session = initialSession;
	let unsubscribe: (() => void) | undefined;
	const tasksScreen: DevScreen = {
		key: 't',
		description: 'toggle Runtime tasks',
		render: () => renderTasksTable(session.getTasks())
	};

	const attachSession = (next: DevSession) => {
		unsubscribe?.();
		session = next;
		unsubscribe = next.subscribe(() => {
			terminal.refresh(tasksScreen);
		});
		terminal.refresh(tasksScreen);
	};

	const stopTerminal = () => {
		unsubscribe?.();
		terminal.close();
	};
	const shutdownDevServer = () => {
		stopTerminal();
		void server.close().finally(() => process.exit(0));
	};

	// Vite reuses inlineConfig when its built-in restart shortcut creates the next server.
	server.config.inlineConfig.customLogger = terminal.logger;
	(server.config.inlineConfig as InlineConfigWithSession)[bindDevSession] = attachSession;
	attachSession(session);
	process.once('exit', stopTerminal);
	process.once('SIGINT', shutdownDevServer);

	try {
		await server.listen();
		await showDevBanner(server, terminal.logger);

		server.bindCLIShortcuts({
			print: true,
			customShortcuts: [
				{
					key: tasksScreen.key,
					description: tasksScreen.description,
					action: () => terminal.toggle(tasksScreen)
				}
			]
		});
	} catch (error) {
		process.off('exit', stopTerminal);
		process.off('SIGINT', shutdownDevServer);
		stopTerminal();
		await server.close();
		throw error;
	}
}
