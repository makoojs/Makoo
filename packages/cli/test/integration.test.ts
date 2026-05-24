import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config/resolve';
import { scanner } from '../src/scanner/scanner';
import { makooMonkey } from '../src/vitePlugin/makooMonkeyPlugin';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

describe('scanner integration', () => {
	it('loads real config and manifests, merges module metadata and filters disabled injections', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				export default {
					globalInjector: { timeout: 9000 },
					injections: [
						{ name: 'from-manifest', injectAt: 'body', component: './from-manifest/index.tsx', framework: 'React' },
						{ name: 'override-me', injectAt: '#old', component: './override-me/old.tsx', framework: 'React', timeout: 1 },
						{ name: 'disabled-manifest', injectAt: '#skip', component: './disabled/index.tsx', framework: 'React', enabled: false }
					]
				};
			`,
			'injections/from-manifest/index.tsx':
				'export default function FromManifest() { return null; }',
			'injections/override-me/manifest.ts': `
				export default {
					name: 'override-me',
					injectAt: '#new',
					component: './index.tsx',
					framework: 'React',
					alive: true,
					timeout: 123
				};
			`,
			'injections/override-me/index.tsx':
				'export default function OverrideMe() { return null; }',
			'injections/module-only/manifest.ts': `
				export default {
					name: 'module-only',
					injectAt: '#module',
					component: './index.tsx',
					framework: 'React'
				};
			`,
			'injections/module-only/index.tsx':
				'export default function ModuleOnly() { return null; }',
			'injections/disabled-module/manifest.ts': `
				export default {
					name: 'disabled-module',
					injectAt: '#disabled',
					component: './index.tsx',
					framework: 'React',
					enabled: false
				};
			`,
			'injections/disabled-module/index.tsx':
				'export default function DisabledModule() { return null; }'
		});

		const result = await withCwd(root, () =>
			scanner(
				resolveConfig(
					{
						app: { name: 'scan-script', version: '0.0.1' }
					},
					root
				)
			)
		);
		const modules = Object.fromEntries(
			result.injections.map((injection) => [injection.moduleId, injection])
		);

		expect(result.manifestFile).toBe(path.join(root, 'injections/manifest.ts'));
		expect(result.config.source.dir).toBe(path.join(root, 'injections'));
		expect(result.injections.map((injection) => injection.moduleId)).toEqual([
			'from-manifest',
			'module-only',
			'override-me'
		]);
		expect(modules['from-manifest']).toMatchObject({
			injectAt: 'body',
			framework: 'React',
			timeout: 9000,
			enabled: true
		});
		expect(modules['override-me']).toMatchObject({
			injectAt: '#new',
			framework: 'React',
			alive: true,
			timeout: 123,
			enabled: true
		});
		expect(modules['override-me'].componentPath).toBe(
			path.join(root, 'injections/override-me/index.tsx')
		);
		expect(modules['module-only']).toMatchObject({
			injectAt: '#module',
			framework: 'React',
			timeout: 9000,
			enabled: true
		});
		expect(modules['disabled-manifest']).toBeUndefined();
		expect(modules['disabled-module']).toBeUndefined();
		expect(result.frameworks).toEqual(['React']);
	});
});

describe('makooMonkey build integration', () => {
	it('injects makooPlugin and vite-plugin-monkey so Vite builds the generated virtual entry into a userscript', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				export default {
					injections: [
						{ name: 'hello-widget', injectAt: 'body', component: './hello/index.ts', framework: 'React' }
					]
				};
			`,
			'injections/hello/index.ts': 'export default function HelloWidget() { return null; }'
		});

		await withCwd(root, async () => {
			await build({
				root,
				configFile: false,
				logLevel: 'silent',
				plugins: makooMonkey({
					root,
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
						build: {
							fileName: 'build-script.user.js',
							metaFileName: false
						}
					}
				}),
				resolve: {
					alias: {
						'@makoo/core': path.resolve(__dirname, '../../core/src/index.ts'),
						'@makoo/react': path.resolve(__dirname, '../../react/src/index.ts'),
						'@makoo/vue': path.resolve(__dirname, '../../vue/src/index.ts')
					}
				},
				build: {
					outDir: 'dist',
					emptyOutDir: true,
					minify: false
				}
			});
		});

		const distFiles = await readdir(path.join(root, 'dist'));
		expect(distFiles).toContain('build-script.user.js');
		expect(distFiles).not.toContain('build-script.meta.js');

		const userscript = await readFile(path.join(root, 'dist/build-script.user.js'), 'utf8');
		const header = userscript.slice(0, 1000);
		expect(header).toMatch(/\/\/ @name\s+build-script/);
		expect(header).toMatch(/\/\/ @namespace\s+https:\/\/makoo\.test/);
		expect(header).toMatch(/\/\/ @version\s+0\.0\.7/);
		expect(header).toMatch(/\/\/ @description\s+build integration test/);
		expect(header).toMatch(/\/\/ @match\s+https:\/\/example\.com\/\*/);
		expect(userscript).toContain('new Injector');
		expect(userscript).toContain('createReactAdapter');
		expect(userscript).toContain('register("body"');
		expect(userscript).toContain('.run()');
		expect(userscript).not.toContain('virtual:makoo/entry');
	});
});
