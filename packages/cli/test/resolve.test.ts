import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAKE_ENTRY } from '../src/config/defaults';
import { resolveConfig, resolveMonkeyPluginOptions } from '../src/config/resolve';

const root = path.resolve('/project');

describe('resolveConfig', () => {
	it('resolves app metadata into monkey userscript and applies defaults', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'demo-script',
					version: '1.2.3',
					description: 'demo description'
				},
				monkey: {
					userscript: {
						match: ['https://example.com/*']
					},
					build: {
						metaFileName: true
					}
				}
			},
			root
		);

		expect(config.root).toBe(root);
		expect(config.source.dir).toBe(path.join(root, 'injections'));
		expect(config.source.include).toEqual(['*']);
		expect(config.source.exclude).toEqual([]);
		expect(config.injector).toMatchObject({ alive: false, scope: 'local', timeout: 5000 });
		expect(config.monkey.userscript).toMatchObject({
			name: 'demo-script',
			version: '1.2.3',
			description: 'demo description',
			match: ['https://example.com/*']
		});
		expect(config.monkey.align).toBe(2);
		expect(config.monkey.clientAlias).toBe('$');
		expect(config.monkey.styleImport).toBe(true);
		expect(config.monkey.server.prefix).toBe('server:');
		expect(config.monkey.server.mountGmApi).toBe(false);
		expect(config.monkey.build.fileName).toBe('demo-script.user.js');
		expect(config.monkey.build.metaFileName).toBe('demo-script.meta.js');
		expect(config.monkey.build.autoGrant).toBe(true);
	});
});

describe('resolveMonkeyPluginOptions', () => {
	it('maps resolved makoo config to vite-plugin-monkey options and protects virtual entry', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'demo-script',
					version: '1.2.3'
				},
				monkey: {
					userscript: {
						namespace: 'https://makoo.test',
						match: ['https://example.com/*']
					},
					server: {
						open: false
					},
					build: {
						fileName: 'demo.user.js'
					}
				}
			},
			root
		);

		const options = resolveMonkeyPluginOptions(config, {
			userscript: {
				match: ['https://override.test/*']
			},
			server: {
				mountGmApi: true
			},
			build: {
				autoGrant: false
			}
		});

		expect(options.entry).toBe(`./${FAKE_ENTRY}`);
		expect(options.userscript).toMatchObject({
			name: { '': 'demo-script' },
			version: '1.2.3',
			namespace: 'https://makoo.test',
			match: ['https://override.test/*']
		});
		expect(options.server).toMatchObject({
			open: false,
			prefix: 'server:',
			mountGmApi: true
		});
		expect(options.build).toMatchObject({
			fileName: 'demo.user.js',
			metaFileName: false,
			autoGrant: false
		});
	});
});
