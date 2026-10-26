import { build, type InlineConfig } from 'vite';

export async function buildCommand(config?: InlineConfig): Promise<void> {
	await build(config);
}
