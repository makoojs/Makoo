import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatInspectInjection, formatInspectResult } from '../src/command/inspect';
import { resolveConfig, resolveInjection } from '../src/config/resolve';
import type { ResolvedInjectorConfig } from '../src/config/types';
import type { ScannerResult } from '../src/scanner/types';

const root = path.resolve('/project');
const injector: ResolvedInjectorConfig = {
	alive: true,
	scope: 'global',
	timeout: 9000,
	hooks: {
		'run:start': () => 'run-start'
	}
};

describe('formatInspectResult', () => {
	it('groups scan and config data without nesting the full config twice', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'inspect-demo',
					version: '1.0.0'
				},
				runtime: {
					setup: ['./injections/setup.ts']
				},
				monkey: {
					userscript: {
						match: ['https://example.com/*']
					}
				}
			},
			root
		);
		const injection = resolveInjection(
			{
				name: 'panel',
				injectAt: '#app',
				component: './panel/index.tsx',
				framework: 'React',
				match: ['https://example.com/*']
			},
			{
				root,
				source: config.source,
				injector,
				componentPath: path.join(root, 'injections/panel/index.tsx')
			}
		);
		const scanResult: ScannerResult = {
			config,
			injector,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestDependencies: [path.join(root, 'injections/hooks.ts')],
			moduleManifestDependencies: [path.join(root, 'injections/panel/options.ts')],
			runtimeSetupFiles: [path.join(root, 'injections/setup.ts')],
			runtimeDependencies: [path.join(root, 'injections/runtime.ts')],
			injections: [injection],
			frameworks: ['React']
		};

		const result = formatInspectResult(scanResult);

		expect(result).toMatchObject({
			project: {
				root: config.root,
				app: config.app
			},
			source: {
				config: config.source,
				manifestFile: scanResult.manifestFile,
				moduleManifestFiles: [],
				dependencies: {
					manifest: scanResult.manifestDependencies,
					moduleManifests: scanResult.moduleManifestDependencies
				}
			},
			runtime: {
				setupFiles: scanResult.runtimeSetupFiles,
				dependencies: scanResult.runtimeDependencies
			},
			monkey: config.monkey,
			injector,
			frameworks: ['React']
		});
		expect(result).not.toHaveProperty('config');
		expect(result.runtime).not.toHaveProperty('config');
		expect(result.injections[0]).not.toHaveProperty('config');
	});
});

describe('formatInspectInjection', () => {
	it('keeps listener, hooks and match data while separating resolved injector values', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'inspect-injection',
					version: '1.0.0'
				}
			},
			root
		);
		const hooks = {
			'artifact:mountSuccess': () => 'mounted'
		};
		const callback = () => undefined;
		const injection = resolveInjection(
			{
				name: 'button-panel',
				injectAt: '#app',
				component: './button/index.tsx',
				framework: 'React',
				timeout: 1000,
				match: {
					include: ['https://example.com/*'],
					exclude: ['https://example.com/admin/*']
				},
				on: {
					listenAt: '#button',
					type: 'click',
					callback
				},
				hooks
			},
			{
				root,
				source: config.source,
				injector,
				componentPath: path.join(root, 'injections/button/index.tsx')
			}
		);

		const result = formatInspectInjection(injection, injector);

		expect(result).toMatchObject({
			moduleId: 'button-panel',
			injectAt: '#app',
			framework: 'React',
			match: {
				include: ['https://example.com/*'],
				exclude: ['https://example.com/admin/*']
			},
			on: {
				listenAt: '#button',
				type: 'click',
				callback
			},
			hooks,
			injectionDefault: {
				alive: true,
				scope: 'global',
				timeout: 1000
			},
			injectorOverrides: {
				timeout: 1000
			}
		});
		expect(result).not.toHaveProperty('alive');
		expect(result).not.toHaveProperty('scope');
		expect(result).not.toHaveProperty('timeout');
	});

	it('omits injectorOverrides when module values match injector defaults', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'inspect-defaults',
					version: '1.0.0'
				}
			},
			root
		);
		const injection = resolveInjection(
			{
				name: 'default-panel',
				injectAt: '#app',
				component: './default/index.tsx',
				framework: 'React'
			},
			{
				root,
				source: config.source,
				injector,
				componentPath: path.join(root, 'injections/default/index.tsx')
			}
		);

		const result = formatInspectInjection(injection, injector);

		expect(result).toMatchObject({
			injectionDefault: {
				alive: true,
				scope: 'global',
				timeout: 9000
			}
		});
		expect(result).not.toHaveProperty('injectorOverrides');
	});
});
