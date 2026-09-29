import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readUserscript } from '@makoojs/test';
import { describe, expect, it } from 'vitest';
import '@makoojs/test/vitest';
import { buildFrameworkFixture } from '../frameworks/buildFixture';

describe('real framework userscript artifacts', () => {
	it.each([
		'vue',
		'react'
	] as const)('builds %s through the actual framework pipeline', async (framework) => {
		const output = await mkdtemp(resolve(tmpdir(), 'makoo-framework-'));
		const modules = new Set<string>();
		try {
			const path = await buildFrameworkFixture(framework, output, 'http://127.0.0.1:4173', [
				{
					name: 'record-fixture-modules',
					moduleParsed(info) {
						modules.add(info.id.replaceAll('\\', '/'));
					}
				}
			]);
			const artifact = await readUserscript(path);
			expect(artifact).toHaveMetadata('name', `makoo-${framework}-counter`);
			expect(artifact).toHaveMetadataValues('match', ['http://127.0.0.1:4173/*']);
			expect(artifact).toHaveGrant('none');
			expect(artifact).toHaveClassicScriptSyntax();
			expect(artifact).toHaveSameMetadataAs(
				await readUserscript(resolve(output, `${framework}.meta.js`))
			);
			expect((await readdir(output)).sort()).toEqual([
				`${framework}.meta.js`,
				`${framework}.user.js`
			]);
			const graph = [...modules].join('\n');
			if (framework === 'vue') {
				expect(graph).toContain('/vue/Counter.vue');
				expect(graph).toContain('/pinia/dist/pinia.mjs');
				expect(graph).toContain('/vue/src/VueAdapter.ts');
			} else {
				expect(graph).toContain('/react/Counter.tsx');
				expect(graph).toContain('/react-dom/');
				expect(graph).toContain('/react/src/ReactAdapter.ts');
			}
		} finally {
			await rm(output, { recursive: true, force: true });
		}
	});
});
