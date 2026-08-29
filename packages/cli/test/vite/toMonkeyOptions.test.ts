import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/config/resolve';
import { resolveMonkeyPluginOptions } from '../../src/vite/toMonkeyOptions';

const root = path.resolve('/project');

describe('resolveMonkeyPluginOptions', () => {
	it('passes the real entry and monkey options to vite-plugin-monkey', () => {
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
});
