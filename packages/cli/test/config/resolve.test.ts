import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig, resolveMonkeyPluginOptions } from '../../src/config/resolve';

const root = path.resolve('/project');

describe('resolveConfig', () => {
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
		expect(options).not.toHaveProperty('clientAlias');
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
