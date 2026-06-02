import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig, resolveInjection } from '../src/config/resolve';
import { generate } from '../src/generator/generator';
import type { ScannerResult } from '../src/scanner/type';

const root = path.resolve('/project');

describe('generate', () => {
	it('generates imports, injector initialization, component registration and injector.run()', () => {
		const config = resolveConfig(
			{
				app: {
					name: 'demo-script',
					version: '1.0.0'
				},
				injector: {
					hooks: {
						'run:start': () => 'run-start'
					}
				}
			},
			root
		);
		const injection = resolveInjection(
			{
				name: 'hello-card',
				injectAt: '#app',
				component: './hello/index.tsx',
				framework: 'React',
				alive: true,
				on: {
					listenAt: '#app',
					type: 'click',
					callback: () => 'clicked'
				}
			},
			{
				root,
				source: config.source,
				injector: config.injector,
				componentPath: path.join(root, 'injections/hello/index.tsx')
			}
		);
		const scanResult: ScannerResult = {
			config,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestDependencies: [],
			injections: [injection],
			frameworks: ['React']
		};

		const result = generate(scanResult);

		expect(result.instanceName).toBe('injector');
		expect(result.code).toContain(
			`import Injection_hello_card from '${path.join(root, 'injections/hello/index.tsx').replace(/\\/g, '/')}';`
		);
		expect(result.code).toContain("import { Injector } from '@makoo/core';");
		expect(result.code).toContain('import { createReactAdapter } from "@makoo/react";');
		expect(result.code).toContain('import { createElement } from "react";');
		expect(result.code).toContain('const injector = new Injector(');
		expect(result.code).toContain('"run:start":(() => "run-start")');
		expect(result.code).toContain('injector.applyAdapter(createReactAdapter());');
		expect(result.code).toContain('injector.register("#app", createElement(Injection_hello_card),');
		expect(result.code).toContain('"listenAt":"#app"');
		expect(result.code).toContain('"type":"click"');
		expect(result.code).toContain('"callback":(() => "clicked")');
		expect(result.code).toContain('injector.run()');
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
				injector: config.injector,
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
				injector: config.injector,
				componentPath: path.join(root, 'injections/plain/index.tsx')
			}
		);
		const scanResult: ScannerResult = {
			config,
			manifestFile: path.join(root, 'injections/manifest.ts'),
			manifestDependencies: [],
			injections: [matchedInjection, plainInjection],
			frameworks: ['React']
		};

		const result = generate(scanResult);

		expect(result.code).toContain('const matchUrl = (url, match) => {');
		expect(result.code).toContain(
			'if (matchUrl(location.href, {"include":["https://example.com/*"],"exclude":["https://example.com/admin/*"]})) {'
		);
		expect(result.code).toContain('injector.register("#app", createElement(Injection_matched_card),');
		expect(result.code).toContain(
			'injector.register("#plain", createElement(Injection_plain_card),'
		);
	});
});
