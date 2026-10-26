import { createServer, type InlineConfig } from 'vite';
import { DevTerminal } from '../tui/DevTerminal';
import { loadCliVersion } from './version';

export async function devCommand(config?: InlineConfig): Promise<void> {
	const server = await createServer(config);
	const cliVersion = await loadCliVersion(null);
	const terminal = new DevTerminal(server, cliVersion);
	await terminal.start();
}
