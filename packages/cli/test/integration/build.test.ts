// @vitest-environment node

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '../../../..');
let cliPath: string;

beforeAll(async () => {
	const root = await trackProject({});
	const outDir = path.join(root, 'cli');
	await execFileAsync(
		process.execPath,
		[
			path.join(repoRoot, 'node_modules/tsup/dist/cli-default.js'),
			'packages/cli/src/cli/bin.ts',
			'--no-config',
			'--format',
			'esm',
			'--no-splitting',
			'--external',
			'vite',
			'--out-dir',
			outDir,
			'--silent'
		],
		{ cwd: repoRoot, timeout: 15_000 }
	);
	cliPath = path.join(outDir, 'bin.js');
});
afterAll(cleanupTempProjects);

describe('CLI build integration', () => {
	it('builds the supplied root and config, applies CLI overrides, and excludes dev instrumentation', async () => {
		const makoo = pathToFileURL(path.join(repoRoot, 'packages/cli/src/vite/makoo.ts')).href;
		const makooDev = pathToFileURL(
			path.join(repoRoot, 'packages/cli/src/vite/makooDev.ts')
		).href;
		const coreEntry = path.join(repoRoot, 'packages/core/src/index.ts');
		const root = await trackProject({
			'src/main.ts': `
				import { createMakoo } from '@makoojs/core';
				createMakoo();
				globalThis.__cliBuild = 'manual-main-' + import.meta.env.MODE;
			`,
			'vite.custom.ts': `
				import { makoo } from ${JSON.stringify(makoo)};
				import { makooDev } from ${JSON.stringify(makooDev)};
				export default {
					resolve: { alias: { '@makoojs/core': ${JSON.stringify(coreEntry)} } },
					plugins: [makooDev(), ...makoo({
						root: import.meta.dirname,
						entry: 'src/main.ts',
						app: { name: 'build-script', version: '0.0.7' },
						monkey: { userscript: { match: ['https://example.com/*'] } }
					})],
					build: { outDir: 'ignored-dist' }
				};
			`
		});
		await execFileAsync(
			process.execPath,
			[
				cliPath,
				'build',
				root,
				'--config',
				path.join(root, 'vite.custom.ts'),
				'--mode',
				'staging',
				'--outDir',
				'release',
				'--no-minify',
				'--logLevel',
				'silent'
			],
			{ cwd: repoRoot, timeout: 15_000 }
		);
		const script = await readFile(path.join(root, 'release/build-script.user.js'), 'utf8');
		expect(script).toMatch(/\/\/ @name\s+build-script/);
		expect(script).toMatch(/\/\/ @version\s+0\.0\.7/);
		expect(script).toContain('manual-main-staging');
		expect(script).not.toMatch(/makoo:runtime:open|makoo:runtime:event|virtual:makoo-dev/);
	});
});
