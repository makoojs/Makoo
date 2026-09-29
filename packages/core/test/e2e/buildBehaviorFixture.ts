import { resolve } from 'node:path';
import { build } from 'vite';
import { makoo } from '../../../cli/src/vite/makoo';

export type Behavior = 'alive' | 'matching' | 'storage';
export type BehaviorFault = 'disable-alive' | 'remove-exclude' | 'skip-storage-write';

export async function buildBehaviorFixture(
	behavior: Behavior,
	baseURL: string,
	outDir: string,
	fault?: BehaviorFault
) {
	const root = resolve(import.meta.dirname, 'behavior');
	await build({
		root,
		configFile: false,
		logLevel: 'silent',
		define: {
			__ALIVE__: JSON.stringify(fault !== 'disable-alive'),
			__PERSIST__: JSON.stringify(fault !== 'skip-storage-write')
		},
		plugins: makoo({
			root,
			entry: `./${behavior}.ts`,
			app: { name: `makoo-core-${behavior}`, version: '0.0.1' },
			monkey: {
				userscript: {
					namespace: 'makoo-core-behavior',
					match: [`${baseURL}/${behavior === 'matching' ? 'eligible/' : ''}*`],
					...(behavior === 'matching' && fault !== 'remove-exclude'
						? { exclude: [`${baseURL}/eligible/excluded`] }
						: {}),
					grant: behavior === 'storage' ? ['GM.getValue', 'GM.setValue'] : ['none'],
					'run-at': 'document-end'
				},
				build: { fileName: `${behavior}.user.js`, metaFileName: false }
			}
		}),
		build: { outDir, emptyOutDir: true, minify: false }
	});
	return resolve(outDir, `${behavior}.user.js`);
}
