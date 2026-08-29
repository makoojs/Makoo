import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../../src/config/errors';
import { validateCliConfig } from '../../src/config/validation';

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

	it('requires entry, app metadata, and monkey', () => {
		expect(() =>
			validateCliConfig({
				app: { name: '', version: '' }
			})
		).toThrow(ConfigValidationError);

		expect(() =>
			validateCliConfig({
				entry: './src/main.ts',
				app: { name: 'demo-script', version: '1.0.0' }
			})
		).toThrow(ConfigValidationError);
	});

	it('rejects removed manifest-era config instead of accepting it as compatibility input', () => {
		try {
			validateCliConfig({
				entry: './src/main.ts',
				app: { name: 'demo-script', version: '1.0.0' },
				monkey: {},
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
