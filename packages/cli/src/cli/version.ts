import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function loadCliVersion(cliVersionCache: string | null): Promise<string> {
	if (cliVersionCache) return cliVersionCache;

	let currentDir = dirname(fileURLToPath(import.meta.url));

	while (true) {
		const packagePath = join(currentDir, 'package.json');

		try {
			const content = await readFile(packagePath, 'utf-8');
			const packageJson = JSON.parse(content) as { name?: string; version?: string };

			if (packageJson.name === '@makoojs/cli' && packageJson.version) {
				return packageJson.version;
			}
		} catch {}

		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) break;
		currentDir = parentDir;
	}

	return '0.0.0';
}
