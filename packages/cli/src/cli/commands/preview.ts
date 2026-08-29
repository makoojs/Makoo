import { preview } from 'vite';

export async function previewCommand(): Promise<void> {
	const server = await preview();
	server.printUrls();
	server.bindCLIShortcuts({ print: true });
}
