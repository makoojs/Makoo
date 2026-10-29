import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCliVersion } from '../../src/commands/version';

describe('loadCliVersion', () => {
	it('finds the CLI package version', async () => {
		const packageJson = JSON.parse(
			readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
		) as { version: string };
		await expect(loadCliVersion()).resolves.toBe(packageJson.version);
	});
});
