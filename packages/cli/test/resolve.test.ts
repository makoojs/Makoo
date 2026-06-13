import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAKE_ENTRY } from '../src/config/defaults';
import {
	normalizeInjectionManifest,
	resolveConfig,
	resolveInjection,
	resolveMonkeyBuildConfig,
	resolveMonkeyPluginOptions
} from '../src/config/resolve';
import { ComponentNotFoundError, UnknownFrameworkError } from '../src/error/error';

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
		expect(config.runtime.setup).toEqual([]);
		expect(config.monkey.userscript).toMatchObject({
			name: 'demo-script',
			version: '1.2.3',
			description: 'demo description',
			match: ['https://example.com/*']
		});
		expect(config.monkey.align).toBe(2);
		expect(config.monkey.styleImport).toBe(true);
		expect(config.monkey.server.prefix).toBe('server:');
		expect(config.monkey.server.mountGmApi).toBe(false);
		expect(config.monkey.build.fileName).toBe('demo-script.user.js');
		expect(config.monkey.build.metaFileName).toBe('demo-script.meta.js');
		expect(config.monkey.build.autoGrant).toBe(true);
	});

	it('resolves runtime setup imports relative to project root', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'runtime-setup',
					version: '0.0.1'
				},
				runtime: {
					setup: ['./injections/vue-setup.ts', '/shared/gm-setup.ts']
				}
			},
			root
		);

		expect(config.runtime.setup).toEqual([
			path.join(root, 'injections/vue-setup.ts'),
			path.normalize('/shared/gm-setup.ts')
		]);
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
						fileName: 'demo.user.js',
						externalGlobals: {
							react: 'React'
						},
						externalResource: {
							'element-plus/dist/index.css': [
								'element-plus-css',
								'https://cdn.example.com/element-plus.css'
							]
						}
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
		expect(options.clientAlias).toBe('$');
		expect(options.server).toMatchObject({
			open: false,
			prefix: 'server:',
			mountGmApi: true
		});
		expect(options.build).toMatchObject({
			fileName: 'demo.user.js',
			externalGlobals: {
				react: 'React'
			},
			metaFileName: false,
			autoGrant: false,
			externalResource: {
				'element-plus/dist/index.css': [
					'element-plus-css',
					'https://cdn.example.com/element-plus.css'
				]
			}
		});
	});
});

describe('resolve helpers', () => {
	it('normalizes object-form injection manifests into named entries', () => {
		expect(
			normalizeInjectionManifest({
				injections: {
					header: {
						injectAt: '#header',
						component: './Header.tsx'
					}
				}
			})
		).toEqual([
			{
				name: 'header',
				injectAt: '#header',
				component: './Header.tsx'
			}
		]);
	});

	it('returns an empty array when no injections are defined', () => {
		expect(normalizeInjectionManifest(undefined)).toEqual([]);
		expect(normalizeInjectionManifest({ injections: [] })).toEqual([]);
	});

	it('resolves injection module id, framework, override path, and injector defaults', () => {
		const result = resolveInjection(
			{
				injectAt: '#root',
				component: './widgets/Card.tsx',
				match: {
					include: ['https://example.com/profile/*'],
					exclude: ['https://example.com/profile/settings']
				}
			},
			{
				root,
				moduleDir: 'features/profile',
				componentPath: 'features/profile/widgets/Card.tsx',
				overridePath: 'overrides/card.css',
				injector: {
					alive: true,
					scope: 'global',
					timeout: 9000
				}
			}
		);

		expect(result).toMatchObject({
			moduleId: 'profile',
			framework: 'React',
			enabled: true,
			alive: true,
			scope: 'global',
			timeout: 9000,
			match: {
				include: ['https://example.com/profile/*'],
				exclude: ['https://example.com/profile/settings']
			},
			moduleDir: path.join(root, 'features/profile'),
			componentPath: path.join(root, 'features/profile/widgets/Card.tsx'),
			overridePath: path.join(root, 'overrides/card.css')
		});
	});

	it('normalizes shorthand match arrays into include lists', () => {
		const result = resolveInjection(
			{
				injectAt: '#hero',
				component: './Hero.vue',
				framework: 'Vue',
				match: ['https://example.com/*']
			},
			{
				root,
				componentPath: 'features/hero/Hero.vue'
			}
		);

		expect(result.match).toEqual({
			include: ['https://example.com/*']
		});
	});

	it('prefers explicit names and supports custom fallback module ids', () => {
		const named = resolveInjection(
			{
				name: 'hero-banner',
				injectAt: '#hero',
				component: './Hero.vue',
				framework: 'Vue'
			},
			{
				root,
				moduleDir: 'features/hero',
				componentPath: 'features/hero/Hero.vue'
			}
		);
		const fallback = resolveInjection(
			{
				injectAt: '#hero',
				component: './Hero.vue',
				framework: 'Vue'
			},
			{
				root,
				componentPath: 'features/hero/Hero.vue',
				moduleId: 'custom-id',
				fallbackName: 'fallback-id'
			}
		);

		expect(named.moduleId).toBe('hero-banner');
		expect(fallback.moduleId).toBe('custom-id');
	});

	it('resolves monkey build meta file names for boolean, callback, and string overrides', () => {
		const app = {
			name: 'demo-script',
			version: '1.0.0'
		};

		expect(resolveMonkeyBuildConfig(app, { build: { metaFileName: false } }).metaFileName).toBe(
			false
		);
		expect(
			resolveMonkeyBuildConfig(app, {
				build: {
					fileName: 'demo.user.js',
					metaFileName: (fileName) => fileName.replace('.user.js', '.userscript.meta.js')
				}
			}).metaFileName
		).toBe('demo.userscript.meta.js');
		expect(
			resolveMonkeyBuildConfig(app, {
				build: {
					metaFileName: 'custom.meta.js'
				}
			}).metaFileName
		).toBe('custom.meta.js');
	});

	it('preserves externalGlobals and externalResource in resolved monkey build config', () => {
		const app = {
			name: 'demo-script',
			version: '1.0.0'
		};

		const result = resolveMonkeyBuildConfig(app, {
			build: {
				externalGlobals: {
					vue: 'Vue'
				},
				externalResource: {
					'element-plus/dist/index.css': [
						'element-plus-css',
						'https://cdn.example.com/element-plus.css'
					]
				}
			}
		});

		expect(result.externalGlobals).toEqual({
			vue: 'Vue'
		});
		expect(result.externalResource).toEqual({
			'element-plus/dist/index.css': [
				'element-plus-css',
				'https://cdn.example.com/element-plus.css'
			]
		});
	});

	it('throws an unknown framework error when component extension cannot be inferred', () => {
		expect(() =>
			resolveInjection(
				{
					injectAt: '#unknown',
					component: './Widget.svelte'
				},
				{ root, componentPath: 'features/Widget.svelte' }
			)
		).toThrow(UnknownFrameworkError);
	});

	it('falls back to generated module ids when no explicit name can be derived', () => {
		const result = resolveInjection(
			{
				injectAt: '#generated',
				component: './index.vue',
				framework: 'Vue'
			},
			{
				root,
				moduleDir: '/',
				componentPath: 'index.vue',
				index: 2
			}
		);

		expect(result.moduleId).toBe('index');
	});

	it('throws when a component path is not provided in resolution options', () => {
		expect(() =>
			resolveInjection(
				{
					injectAt: '#missing',
					component: './Widget.vue',
					framework: 'Vue'
				},
				{
					root
				}
			)
		).toThrow(ComponentNotFoundError);
	});
});
