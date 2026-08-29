import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { makoo } from '../../src/vite/makoo';
import { cleanupTempProjects, trackProject, withCwd } from '../utils/tempProject';

afterEach(cleanupTempProjects);

describe('makoo build integration', () => {
	it('builds the user-authored browser entry directly', async () => {
		const root = await trackProject({
			'src/main.ts': `
				(globalThis as { __makooManualEntry?: string }).__makooManualEntry = 'manual-main';
			`
		});

		await withCwd(root, async () => {
			await build({
				root,
				configFile: false,
				logLevel: 'silent',
				plugins: makoo({
					root,
					entry: './src/main.ts',
					app: {
						name: 'build-script',
						version: '0.0.7',
						description: 'build integration test'
					},
					monkey: {
						userscript: {
							namespace: 'https://makoo.test',
							match: ['https://example.com/*']
						},
						build: { fileName: 'build-script.user.js', metaFileName: false }
					}
				}),
				build: { outDir: 'dist', emptyOutDir: true, minify: false }
			});
		});

		expect(await readdir(path.join(root, 'dist'))).toContain('build-script.user.js');
		const userscript = await readFile(path.join(root, 'dist/build-script.user.js'), 'utf8');
		expect(userscript).toMatch(/\/\/ @name\s+build-script/);
		expect(userscript).toContain('manual-main');
		expect(userscript).not.toContain('virtual:makoo/entry');
	});
});
