import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseMetadata, type UserscriptMetadata } from './metadata.js';

export type UserscriptArtifact = {
	path: string;
	source: string;
	metadata: UserscriptMetadata;
};

export async function readUserscript(path: string): Promise<UserscriptArtifact> {
	const absolutePath = resolve(path);
	const source = await readFile(absolutePath, 'utf8');
	return { path: absolutePath, source, metadata: parseMetadata(source) };
}
