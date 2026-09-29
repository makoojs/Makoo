import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { build, type Plugin } from 'vite';
import { makoo } from '../../../cli/src/vite/makoo';

export async function buildFrameworkFixture(
	framework: 'vue' | 'react',
	outDir: string,
	baseURL: string,
	plugins: Plugin[] = []
) {
	const root = import.meta.dirname;
	await build({
		root,
		configFile: false,
		logLevel: 'silent',
		resolve: {
			alias: {
				'@makoojs/core': resolve(root, '../../src/index.ts'),
				'@makoojs/vue': resolve(root, '../../../vue/src/index.ts'),
				'@makoojs/react': resolve(root, '../../../react/src/index.ts')
			},
			dedupe: ['vue', 'react', 'react-dom']
		},
		plugins: [
			...(framework === 'vue' ? [vue()] : []),
			...makoo({
				root,
				entry: `./${framework}/main.ts`,
				app: { name: `makoo-${framework}-counter`, version: '0.0.1' },
				monkey: {
					userscript: {
						match: [`${baseURL}/*`],
						grant: ['none'],
						'run-at': 'document-end'
					},
					build: { fileName: `${framework}.user.js`, metaFileName: true }
				}
			}),
			...plugins
		],
		build: { outDir, emptyOutDir: true, minify: true }
	});
	return resolve(outDir, `${framework}.user.js`);
}
