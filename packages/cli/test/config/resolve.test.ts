import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/config/resolve';

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
});
