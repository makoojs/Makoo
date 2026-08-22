import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCliVersion } from '../src/command/util';

describe('loadCliVersion', () => {
	it('uses the cached version', async () => {
		await expect(loadCliVersion('9.9.9')).resolves.toBe('9.9.9');
	});

	it('finds the CLI package version', async () => {
		const packageJson = JSON.parse(
			readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
		) as { version: string };
		await expect(loadCliVersion(null)).resolves.toBe(packageJson.version);
	});
});
