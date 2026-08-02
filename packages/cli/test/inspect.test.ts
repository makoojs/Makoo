import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatInspectInjection, formatInspectResult } from '../src/command/inspect';
import { resolveConfig, resolveInjection, resolveListener } from '../src/config/resolve';
import type { ResolvedInjectionDefaults } from '../src/config/types';
import type { ScannerResult } from '../src/scanner/types';

const root = path.resolve('/project');
const injectionDefaults: ResolvedInjectionDefaults = {
	alive: true,
	scope: 'global',
	timeout: 9000,
	hooks: {
		'start:requested': () => 'run-start'
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
				injectionDefaults,
				componentPath: path.join(root, 'injections/panel/index.tsx'),
				moduleManifestFile: path.join(root, 'injections/panel/manifest.ts')
			}
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
			injectionDefaults,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestBindings: { injections: {}, listeners: {} },
			manifestDependencies: [path.join(root, 'injections/hooks.ts')],
			moduleManifestDependencies: [path.join(root, 'injections/panel/options.ts')],
			runtimeSetupFiles: [path.join(root, 'injections/setup.ts')],
			runtimeDependencies: [path.join(root, 'injections/runtime.ts')],
			injections: [injection],
			listeners: [listener],
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
				moduleManifestFiles: [path.join(root, 'injections/panel/manifest.ts')],
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
			injectionDefaults,
			listeners: [
				{
					listenerId: 'visibility',
					listenAt: 'body',
					type: 'visibilitychange',
					callback: listener.callback,
					match: { include: ['https://example.com/*'] },
					enabled: true
				}
			],
			frameworks: ['React']
		});
		expect(result).not.toHaveProperty('config');
		expect(result.runtime).not.toHaveProperty('config');
		expect(result.injections[0]).not.toHaveProperty('config');
		expect(result.injections[0]).toMatchObject({
			moduleManifestFile: path.join(root, 'injections/panel/manifest.ts')
		});
		expect(result.injections[0]).not.toHaveProperty('overridePath');
	});
});

describe('formatInspectInjection', () => {
	it('keeps listener, hooks and match data while separating resolved injection defaults', () => {
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
				injectionDefaults,
				componentPath: path.join(root, 'injections/button/index.tsx')
			}
		);

		const result = formatInspectInjection(injection, injectionDefaults);

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
			injectionDefaults: {
				alive: true,
				scope: 'global',
				timeout: 1000
			},
			injectionDefaultsOverrides: {
				timeout: 1000
			}
		});
		expect(result).not.toHaveProperty('alive');
		expect(result).not.toHaveProperty('scope');
		expect(result).not.toHaveProperty('timeout');
	});

	it('omits injectionDefaultsOverrides when module values match injection defaults', () => {
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
				injectionDefaults,
				componentPath: path.join(root, 'injections/default/index.tsx')
			}
		);

		const result = formatInspectInjection(injection, injectionDefaults);

		expect(result).toMatchObject({
			injectionDefaults: {
				alive: true,
				scope: 'global',
				timeout: 9000
			}
		});
		expect(result).not.toHaveProperty('injectionDefaultsOverrides');
	});
});
