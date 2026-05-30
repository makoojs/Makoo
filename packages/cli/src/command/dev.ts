import { createServer } from 'vite';

export async function devCommand(): Promise<void> {
	const server = await createServer();
	await server.listen();
	server.printUrls();
}
