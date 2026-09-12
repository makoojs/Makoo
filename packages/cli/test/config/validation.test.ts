import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../../src/config/errors';
import { validateCliConfig } from '../../src/config/validation';

const valid = { entry: './src/main.ts', app: { name: 'demo', version: '1.0.0' }, monkey: {} };

describe('validateCliConfig', () => {
	it('accepts Monkey options without changing the input', () => {
		const config = {
			...valid,
			monkey: { server: { open: false }, userscript: { match: ['https://example.com/*'] } }
		};
		const original = structuredClone(config);
		validateCliConfig(config);
		expect(config).toEqual(original);
	});

	it.each([
		{ name: 'missing entry', config: { ...valid, entry: undefined }, path: 'entry' },
		{ name: 'empty entry', config: { ...valid, entry: '' }, path: 'entry' },
		{
			name: 'empty app name',
			config: { ...valid, app: { ...valid.app, name: '' } },
			path: 'app.name'
		},
		{
			name: 'missing app version',
			config: { ...valid, app: { name: 'demo' } },
			path: 'app.version'
		},
		{ name: 'missing monkey', config: { ...valid, monkey: undefined }, path: 'monkey' },
		{ name: 'unknown root option', config: { ...valid, typo: true }, path: '(root)' },
		{
			name: 'unknown app option',
			config: { ...valid, app: { ...valid.app, typo: true } },
			path: 'app'
		}
	])('reports the offending field for $name', ({ config, path }) => {
		expect(() => validateCliConfig(config)).toThrow(ConfigValidationError);
		expect(() => validateCliConfig(config)).toThrow(
			expect.objectContaining({
				code: 'MAKOO_CLI_CONFIG_INVALID',
				issues: expect.arrayContaining([
					expect.objectContaining({ path, message: expect.any(String) })
				])
			})
		);
	});
});
