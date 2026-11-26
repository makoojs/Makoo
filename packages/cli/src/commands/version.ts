import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function loadCliVersion(): Promise<string> {
	// import.meta.dirname covers ESM (Node >= 20.11); the cjs bundle has
	// import.meta = {} but a real __dirname.
	let currentDir =
		import.meta.dirname ?? (typeof __dirname !== 'undefined' ? __dirname : process.cwd());

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
