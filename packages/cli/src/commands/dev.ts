import { createServer, type InlineConfig } from 'vite';

export async function devCommand(config?: InlineConfig): Promise<void> {
	const server = await createServer(config);
	try {
		await server.listen();
		server.printUrls();
		server.bindCLIShortcuts({ print: true });
	} catch (error) {
		await server.close();
		throw error;
	}
}
