import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { makoo } from '../../../cli/src/vite/makoo';

export async function buildFixture(origin: string, outDir: string, excluded = false) {
	const root = resolve(import.meta.dirname, 'fixture');
	await build({
		root,
		configFile: false,
		logLevel: 'warn',
		plugins: makoo({
			root,
			entry: './main.ts',
			app: { name: 'makoo-core-counter', version: '0.0.1', description: 'Core E2E fixture' },
			monkey: {
				userscript: {
					namespace: 'makoo-core-e2e',
					match: [`${origin}/*`],
					...(excluded ? { exclude: [`${origin}/counter`] } : {}),
					grant: ['none'],
					'run-at': 'document-end'
				},
				build: { fileName: 'counter.user.js', metaFileName: false }
			}
		}),
		build: { outDir, emptyOutDir: true, minify: false }
	});
	return readFile(resolve(outDir, 'counter.user.js'), 'utf8');
}
