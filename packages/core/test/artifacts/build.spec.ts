import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseMetadata, readUserscript, type UserscriptArtifact } from '@makoojs/test';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { makoo } from '../../../cli/src/vite/makoo';
import '@makoojs/test/vitest';

const matches = ['https://one.test/*', 'https://two.test/*'];

function checkMetadata(artifact: UserscriptArtifact) {
	expect(artifact).toHaveMetadata('name', 'core-artifact');
	expect(artifact).toHaveMetadata('name:zh-CN', '核心产物');
	expect(artifact).toHaveMetadata('version', '0.0.1');
	expect(artifact).toHaveMetadataValues('match', matches);
	expect(artifact).toHaveMetadata('exclude', 'https://one.test/private/*');
	expect(artifact).toHaveGrant('GM_getValue');
	expect(artifact).toHaveGrant('GM_setValue');
	expect(artifact).not.toHaveGrant('unsafeWindow');
	expect(artifact).toHaveMetadata('require', 'https://assets.test/helper.js');
	expect(artifact).toHaveResource('fixtureData', 'https://assets.test/data.json');
}

describe('real Makoo artifacts', () => {
	it.each([
		true,
		false
	])('checks configured output and metadata (metaFileName=%s)', async (metaFileName) => {
		const root = await mkdtemp(resolve(tmpdir(), 'makoo-core-artifact-'));
		try {
			const core = resolve(import.meta.dirname, '../../src/index.ts');
			await writeFile(
				resolve(root, 'main.ts'),
				`
import { createMakoo, listen } from ${JSON.stringify(core)};
createMakoo().start([listen({
  id: 'artifact-counter', listenAt: '#increment', type: 'click',
  callback: () => { document.body.dataset.clicked = 'yes'; }
})]);
`
			);
			await build({
				root,
				configFile: false,
				logLevel: 'silent',
				plugins: makoo({
					root,
					entry: './main.ts',
					app: { name: 'core-artifact', version: '0.0.1' },
					monkey: {
						userscript: {
							name: { '': 'core-artifact', 'zh-CN': '核心产物' },
							match: matches,
							exclude: ['https://one.test/private/*'],
							grant: ['GM_getValue', 'GM_setValue'],
							require: ['https://assets.test/helper.js'],
							resource: { fixtureData: 'https://assets.test/data.json' }
						},
						build: { fileName: 'core-artifact.user.js', metaFileName, autoGrant: false }
					}
				}),
				build: { outDir: resolve(root, 'dist'), minify: false }
			});
			const output = resolve(root, 'dist');
			expect((await readdir(output)).sort()).toEqual(
				metaFileName
					? ['core-artifact.meta.js', 'core-artifact.user.js']
					: ['core-artifact.user.js']
			);
			const artifact = await readUserscript(resolve(output, 'core-artifact.user.js'));
			checkMetadata(artifact);
			if (metaFileName) {
				const meta = await readUserscript(resolve(output, 'core-artifact.meta.js'));
				expect(artifact).toHaveSameMetadataAs(meta);
			}
			const missingMatch = artifact.source.replace(/^\/\/[\t ]+@match[^\r\n]*\r?\n/m, '');
			expect(() =>
				checkMetadata({
					...artifact,
					source: missingMatch,
					metadata: parseMetadata(missingMatch)
				})
			).toThrow('@match');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
