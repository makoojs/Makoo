import { describe, expect, it } from 'vitest';
import { validateCliConfig } from '../src/config/validation';
import { ConfigValidationError } from '../src/error/MakooCliError';

describe('validateCliConfig', () => {
	it('accepts the toolchain config', () => {
		expect(() =>
			validateCliConfig({
				entry: './src/main.ts',
				app: { name: 'demo-script', version: '1.0.0' },
				monkey: { server: { open: false } }
			})
		).not.toThrow();
	});

	it('requires entry and app metadata', () => {
		expect(() =>
			validateCliConfig({
				app: { name: '', version: '' }
			})
		).toThrow(ConfigValidationError);
	});

	it('rejects removed manifest-era config instead of accepting it as compatibility input', () => {
		try {
			validateCliConfig({
				entry: './src/main.ts',
				app: { name: 'demo-script', version: '1.0.0' },
				source: {},
				runtime: {}
			});
			throw new Error('expected validation to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigValidationError);
			expect(error).toMatchObject({
				issues: [{ path: '(root)', message: expect.stringContaining('source') }]
			});
		}
	});
});
