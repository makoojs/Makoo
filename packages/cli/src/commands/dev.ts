import { createServer, type InlineConfig } from 'vite';
import { DevTerminal, type RuntimeSource } from '../tui/DevTerminal';

export async function devCommand(config?: InlineConfig): Promise<void> {
	const server = await createServer(config);
	const session = server.config.plugins.find((plugin) => plugin.name === 'makoo:dev')?.api
		?.session as RuntimeSource | undefined;
	const terminal = new DevTerminal(server, session);
	try {
		await server.listen();
		await terminal.showHome();
		terminal.activate();
	} catch (error) {
		terminal.close();
		await server.close();
		throw error;
	}
}
