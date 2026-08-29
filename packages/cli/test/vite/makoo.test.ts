import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { makoo } from '../../src/vite/makoo';

describe('makoo', () => {
	it('returns the vite-plugin-monkey plugins', () => {
		const root = path.resolve('/project');
		const plugins = makoo({
			root,
			entry: './src/main.ts',
			app: { name: 'plugin-test', version: '0.0.1' },
			monkey: {}
		});

		expect(plugins.length).toBeGreaterThan(0);
		expect(plugins.some((plugin) => plugin.name === 'monkey:config')).toBe(true);
	});
});
