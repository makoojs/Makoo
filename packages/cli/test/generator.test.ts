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
		expect(result.code).toContain('const injector = new Injector(');
		expect(result.code).toContain('"run:start":(() => "run-start")');
		expect(result.code).toContain('injector.applyAdapter(createReactAdapter());');
		expect(result.code).toContain('injector.register("#app", Injection_hello_card,');
		expect(result.code).toContain('"listenAt":"#app"');
		expect(result.code).toContain('"type":"click"');
		expect(result.code).toContain('"callback":(() => "clicked")');
		expect(result.code).toContain('injector.run()');
	});
});
