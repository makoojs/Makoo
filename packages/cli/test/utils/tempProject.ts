import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');
const tempRoot = path.join(repoRoot, '.tmp', 'rite-tests');

export const createdProjects: string[] = [];

export async function trackProject(files: Record<string, string>): Promise<string> {
	const root = await createTempProject(files);
	createdProjects.push(root);
	return root;
}

export async function cleanupTempProjects(): Promise<void> {
	await Promise.all(createdProjects.splice(0).map((root) => removeTempProject(root)));
}

export async function createTempProject(files: Record<string, string>): Promise<string> {
	const root = path.join(tempRoot, `${Date.now()}-${Math.random().toString(16).slice(2)}`);

	for (const [file, content] of Object.entries(files)) {
		const fullPath = path.join(root, file);
		await mkdir(path.dirname(fullPath), { recursive: true });
		await writeFile(fullPath, content);
	}

	return root;
}

export async function removeTempProject(root: string): Promise<void> {
	await rm(root, { recursive: true, force: true });
}

export async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
	const previous = process.cwd();
	process.chdir(cwd);

	try {
		return await fn();
	} finally {
		process.chdir(previous);
	}
}
