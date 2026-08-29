import { build } from 'vite';

export async function buildCommand(): Promise<void> {
	await build();
}
