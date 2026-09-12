import { type InlineConfig, preview } from 'vite';

export async function previewCommand(config?: InlineConfig): Promise<void> {
	const server = await preview(config);
	server.printUrls();
	server.bindCLIShortcuts({ print: true });
}
