import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig, resolveInjection, resolveListener } from '../src/config/resolve';
import type { ResolvedInjectionDefaults } from '../src/config/types';
import { generate } from '../src/generator/generator';
import type { ScannerResult } from '../src/scanner/types';

const root = path.resolve('/project');
const defaultInjectionDefaults: ResolvedInjectionDefaults = {
	alive: false,
	scope: 'local',
	timeout: 5000
};

describe('generate', () => {
	it('generates imports, makoo initialization, task declarations and makoo.start()', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'demo-script',
					version: '1.0.0'
				}
			},
			root
		);
		const injectionDefaults: ResolvedInjectionDefaults = {
			...defaultInjectionDefaults,
			hooks: {
				'start:requested': () => 'run-start'
			}
		};
		const injection = resolveInjection(
			{
				name: 'hello-card',
				injectAt: '#app',
				component: './hello/index.tsx',
				framework: 'React',
				alive: true,
				hooks: {
					'artifact:mountSuccess': () => 'mounted'
				},
				on: {
					listenAt: '#app',
					type: 'click',
					callback: () => 'clicked',
					capture: false,
					activitySignal: () => ({
						get: () => true,
						subscribe: () => () => {}
					})
				}
			},
			{
				root,
				source: config.source,
				injectionDefaults,
				componentPath: path.join(root, 'injections/hello/index.tsx')
			}
		);
		const scanResult: ScannerResult = {
			config,
			injectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: {
				injectionDefaults: {
					hooks: {
						manifestFile: path.join(root, 'injections/manifest.ts'),
						valuePath: ['injectionDefaults', 'hooks']
					}
				},
				injections: {
					'hello-card': {
						hooks: {
							manifestFile: path.join(root, 'injections/manifest.ts'),
							valuePath: ['injections', 0, 'hooks']
						},
						on: {
							callback: {
								manifestFile: path.join(root, 'injections/manifest.ts'),
								valuePath: ['injections', 0, 'on', 'callback']
							},
							activitySignal: {
								manifestFile: path.join(root, 'injections/manifest.ts'),
								valuePath: ['injections', 0, 'on', 'activitySignal']
							}
						}
					}
				},
				listeners: {}
			},
			manifestDependencies: [],
			moduleManifestDependencies: [],
			runtimeSetupFiles: [],
			runtimeDependencies: [],
			injections: [injection],
			listeners: [],
			frameworks: ['React']
		};

		const result = generate(scanResult);

		expect(result.instanceName).toBe('makoo');
		expect(result.code).toContain(
			`import Injection_hello_card from '${path.join(root, 'injections/hello/index.tsx').replace(/\\/g, '/')}';`
		);
		expect(result.code).toContain(
			`import Manifest_0 from '${path.join(root, 'injections/manifest.ts').replace(/\\/g, '/')}';`
		);
		expect(result.code).toContain(
			"import { createMakoo, inject, listen } from '@makoojs/core';"
		);
		expect(result.code).toContain('import { createReactAdapter } from "@makoojs/react";');
		expect(result.code).toContain('let makoo;');
		expect(result.code).toContain('makoo = createMakoo({');
		expect(result.code).toContain('defaults:');
		expect(result.code).toContain('hooks: Manifest_0["injectionDefaults"]["hooks"]');
		expect(result.code).toContain('adapters: [createReactAdapter()]');
		expect(result.code).toContain('const makooTasks = [];');
		expect(result.code).toContain(
			'makooTasks.push(inject({"id":"hello-card","injectAt":"#app","artifact":Injection_hello_card,"options":'
		);
		expect(result.code).toContain('"hooks":Manifest_0["injections"][0]["hooks"]');
		expect(result.code).toContain(
			'listen({"listenAt":"#app","type":"click","callback":Manifest_0["injections"][0]["on"]["callback"],"capture":false,"activitySignal":Manifest_0["injections"][0]["on"]["activitySignal"]})'
		);
		expect(result.code).not.toContain('run-start');
		expect(result.code).not.toContain('mounted');
		expect(result.code).not.toContain('clicked');
		expect(result.code).not.toContain('subscribe: () => () => {}');
		expect(result.code).toContain('makoo.start(makooTasks)');
	});

	it('wraps matched modules in runtime URL checks', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'demo-script',
					version: '1.0.0'
				}
			},
			root
		);
		const matchedInjection = resolveInjection(
			{
				name: 'matched-card',
				injectAt: '#app',
				component: './hello/index.tsx',
				framework: 'React',
				match: {
					include: ['https://example.com/*'],
					exclude: ['https://example.com/admin/*']
				}
			},
			{
				root,
				source: config.source,
				injectionDefaults: defaultInjectionDefaults,
				componentPath: path.join(root, 'injections/hello/index.tsx')
			}
		);
		const plainInjection = resolveInjection(
			{
				name: 'plain-card',
				injectAt: '#plain',
				component: './plain/index.tsx',
				framework: 'React'
			},
			{
				root,
				source: config.source,
				injectionDefaults: defaultInjectionDefaults,
				componentPath: path.join(root, 'injections/plain/index.tsx')
			}
		);
		const scanResult: ScannerResult = {
			config,
			injectionDefaults: defaultInjectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: { injections: {}, listeners: {} },
			manifestDependencies: [],
			moduleManifestDependencies: [],
			runtimeSetupFiles: [],
			runtimeDependencies: [],
			injections: [matchedInjection, plainInjection],
			listeners: [],
			frameworks: ['React']
		};

		const result = generate(scanResult);

		expect(result.code).toContain('const matchUrl = (url, match) => {');
		expect(result.code).toContain(
			'if (matchUrl(location.href, {"include":["https://example.com/*"],"exclude":["https://example.com/admin/*"]})) {'
		);
		expect(result.code).toContain(
			'makooTasks.push(inject({"id":"matched-card","injectAt":"#app","artifact":Injection_matched_card,"options":'
		);
		expect(result.code).toContain(
			'makooTasks.push(inject({"id":"plain-card","injectAt":"#plain","artifact":Injection_plain_card,"options":'
		);
	});

	it('uses module ids as generated object-form injection ids for same-named components', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'same-component-name',
					version: '1.0.0'
				}
			},
			root
		);
		const firstInjection = resolveInjection(
			{
				name: 'first-panel',
				injectAt: 'body',
				component: './first/App.vue',
				framework: 'Vue'
			},
			{
				root,
				source: config.source,
				injectionDefaults: defaultInjectionDefaults,
				componentPath: path.join(root, 'injections/first/App.vue')
			}
		);
		const secondInjection = resolveInjection(
			{
				name: 'second-panel',
				injectAt: 'body',
				component: './second/App.vue',
				framework: 'Vue'
			},
			{
				root,
				source: config.source,
				injectionDefaults: defaultInjectionDefaults,
				componentPath: path.join(root, 'injections/second/App.vue')
			}
		);
		const scanResult: ScannerResult = {
			config,
			injectionDefaults: defaultInjectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: { injections: {}, listeners: {} },
			manifestDependencies: [],
			moduleManifestDependencies: [],
			runtimeSetupFiles: [],
			runtimeDependencies: [],
			injections: [firstInjection, secondInjection],
			listeners: [],
			frameworks: ['Vue']
		};

		const result = generate(scanResult);

		expect(result.code).toContain(
			'makooTasks.push(inject({"id":"first-panel","injectAt":"body","artifact":Injection_first_panel,"options":'
		);
		expect(result.code).toContain(
			'makooTasks.push(inject({"id":"second-panel","injectAt":"body","artifact":Injection_second_panel,"options":'
		);
	});

	it('renders runtime setup imports before component imports', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'runtime-setup',
					version: '1.0.0'
				},
				runtime: {
					setup: ['./injections/vue-setup.ts']
				}
			},
			root
		);
		const injection = resolveInjection(
			{
				name: 'panel',
				injectAt: '#app',
				component: './panel/App.vue',
				framework: 'Vue'
			},
			{
				root,
				source: config.source,
				injectionDefaults: defaultInjectionDefaults,
				componentPath: path.join(root, 'injections/panel/App.vue')
			}
		);
		const scanResult: ScannerResult = {
			config,
			injectionDefaults: defaultInjectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: { injections: {}, listeners: {} },
			manifestDependencies: [],
			moduleManifestDependencies: [],
			runtimeSetupFiles: [],
			runtimeDependencies: [],
			injections: [injection],
			listeners: [],
			frameworks: ['Vue']
		};

		const result = generate(scanResult);
		const setupImport = `import '${path.join(root, 'injections/vue-setup.ts').replace(/\\/g, '/')}';`;
		const componentImport = `import Injection_panel from '${path.join(root, 'injections/panel/App.vue').replace(/\\/g, '/')}';`;

		expect(result.code).toContain(setupImport);
		expect(result.code.indexOf(setupImport)).toBeLessThan(result.code.indexOf(componentImport));
	});

	it('generates standalone listener tasks with explicit ids and activity signals', () => {
		const activitySignal = () => ({
			get: () => true,
			subscribe: () => () => {}
		});
		const config = resolveConfig(
			{
				app: {
					name: 'listener-only',
					version: '1.0.0'
				}
			},
			root
		);
		const listener = resolveListener(
			{
				listenAt: 'body',
				type: 'keydown',
				callback: () => 'closed',
				capture: false,
				activitySignal
			},
			{ listenerId: 'escape-close' }
		);
		const scanResult: ScannerResult = {
			config,
			injectionDefaults: defaultInjectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: {
				injections: {},
				listeners: {
					'escape-close': {
						callback: {
							manifestFile: path.join(root, 'injections/manifest.ts'),
							valuePath: ['listeners', 'escape-close', 'callback']
						},
						activitySignal: {
							manifestFile: path.join(root, 'injections/manifest.ts'),
							valuePath: ['listeners', 'escape-close', 'activitySignal']
						}
					}
				}
			},
			manifestDependencies: [],
			moduleManifestDependencies: [],
			runtimeSetupFiles: [],
			runtimeDependencies: [],
			injections: [],
			listeners: [listener],
			frameworks: []
		};

		const result = generate(scanResult);

		expect(result.code).toContain('const makooTasks = [];');
		expect(result.code).toContain(
			'makooTasks.push(listen({"id":"escape-close","listenAt":"body","type":"keydown","callback":Manifest_0["listeners"]["escape-close"]["callback"],"capture":false,"activitySignal":Manifest_0["listeners"]["escape-close"]["activitySignal"]}));'
		);
		expect(result.code).not.toContain('get: () => true');
		expect(result.code).not.toContain('subscribe: () => () => {}');
		expect(result.code).toContain('makoo.start(makooTasks)');
	});

	it('wraps matched standalone listeners in runtime URL checks', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'matched-listener',
					version: '1.0.0'
				}
			},
			root
		);
		const listener = resolveListener(
			{
				listenAt: 'body',
				type: 'visibilitychange',
				callback: () => undefined,
				match: ['https://example.com/*']
			},
			{ listenerId: 'visibility' }
		);
		const scanResult: ScannerResult = {
			config,
			injectionDefaults: defaultInjectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: {
				injections: {},
				listeners: {
					visibility: {
						callback: {
							manifestFile: path.join(root, 'injections/manifest.ts'),
							valuePath: ['listeners', 'visibility', 'callback']
						}
					}
				}
			},
			manifestDependencies: [],
			moduleManifestDependencies: [],
			runtimeSetupFiles: [],
			runtimeDependencies: [],
			injections: [],
			listeners: [listener],
			frameworks: []
		};

		const result = generate(scanResult);

		expect(result.code).toContain('const matchUrl = (url, match) => {');
		expect(result.code).toContain(
			'if (matchUrl(location.href, {"include":["https://example.com/*"]})) {'
		);
		expect(result.code).toContain(
			'makooTasks.push(listen({"id":"visibility","listenAt":"body","type":"visibilitychange","callback":Manifest_0["listeners"]["visibility"]["callback"]}));'
		);
	});
});
