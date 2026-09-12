import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig, resolveMonkeyPluginOptions } from '../../src/config/resolve';
import type { CliConfig } from '../../src/config/types';

const root = path.resolve('/project');

describe('resolveConfig', () => {
	it.each([
		{ meta: false, expected: false },
		{ meta: true, expected: 'custom.meta.js' },
		{ meta: 'metadata.js', expected: 'metadata.js' },
		{ meta: (file: string) => `meta-${file}`, expected: 'meta-custom.user.js' }
	])('resolves custom metadata filename $expected', ({ meta, expected }) => {
		const config = resolveConfig(
			{
				entry: './src/main.ts',
				app: { name: 'demo', version: '1.0.0' },
				monkey: {
					build: { fileName: 'custom.user.js', metaFileName: meta, autoGrant: false }
				}
			},
			root
		);
		expect(config.monkey.build).toMatchObject({
			fileName: 'custom.user.js',
			metaFileName: expected,
			autoGrant: false
		});
	});

	it('preserves an absolute entry and passes custom Monkey options without mutating input', () => {
		const input: CliConfig = {
			entry: path.resolve('/shared/main.ts'),
			app: { name: 'demo', version: '1.0.0' },
			monkey: {
				align: false,
				styleImport: false,
				server: { open: false, prefix: false },
				build: { externalGlobals: { vue: 'Vue' }, metaFileName: false }
			}
		};
		const original = structuredClone(input);
		const config = resolveConfig(input, root);
		const options = resolveMonkeyPluginOptions(config);
		expect(options.entry).toBe(input.entry);
		expect(options).toMatchObject({
			align: false,
			styleImport: false,
			server: { open: false, prefix: false },
			build: { externalGlobals: { vue: 'Vue' }, metaFileName: false }
		});
		expect(input).toEqual(original);
	});
	it('resolves a real entry and userscript defaults', () => {
		const config = resolveConfig(
			{
				entry: './src/main.ts',
				app: {
					name: 'demo-script',
					version: '1.2.3',
					description: 'demo description'
				},
				monkey: {
					build: { metaFileName: true }
				}
			},
			root
		);

		expect(config.root).toBe(root);
		expect(config.entry).toBe(path.join(root, 'src/main.ts'));
		expect(config.monkey.userscript).toMatchObject({
			name: 'demo-script',
			version: '1.2.3',
			description: 'demo description'
		});
		expect(config.monkey.server.mountGmApi).toBe(false);
		expect(config.monkey.build.fileName).toBe('demo-script.user.js');
		expect(config.monkey.build.metaFileName).toBe('demo-script.meta.js');
	});

	it('resolves options for vite-plugin-monkey', () => {
		const config = resolveConfig(
			{
				entry: './src/main.ts',
				app: { name: 'demo-script', version: '1.2.3' },
				monkey: {
					userscript: {
						namespace: 'https://makoo.test',
						match: ['https://example.com/*']
					},
					server: { open: false }
				}
			},
			root
		);

		const options = resolveMonkeyPluginOptions(config);

		expect(options.entry).toBe(path.join(root, 'src/main.ts'));
		expect(options.userscript).toMatchObject({
			name: { '': 'demo-script' },
			version: '1.2.3',
			namespace: 'https://makoo.test'
		});
		expect(options.server).toMatchObject({ open: false, mountGmApi: false });
	});

	it('keeps app identity on the userscript even if monkey repeats those fields', () => {
		const config = resolveConfig(
			{
				entry: './src/main.ts',
				app: {
					name: 'demo-script',
					version: '1.2.3',
					description: 'demo description'
				},
				monkey: {
					userscript: {
						name: 'other-name',
						version: '9.9.9',
						description: 'other description',
						match: ['https://example.com/*']
					} as never
				}
			},
			root
		);

		expect(config.monkey.userscript).toMatchObject({
			name: 'demo-script',
			version: '1.2.3',
			description: 'demo description',
			match: ['https://example.com/*']
		});
	});
});
