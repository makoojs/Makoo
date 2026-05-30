import { describe, expect, it } from 'vitest';
import { validateCliConfig } from '../src/config/validation';
import { ConfigValidationError } from '../src/error/error';

describe('validateCliConfig', () => {
	it('accepts a minimal valid CLI config', () => {
		expect(() =>
			validateCliConfig({
				app: {
					name: 'demo-script',
					version: '1.0.0'
				}
			})
		).not.toThrow();
	});

	it('throws ConfigValidationError for invalid CLI config input', () => {
		try {
			validateCliConfig({
				app: {
					name: '',
					version: ''
				}
			});
			throw new Error('expected validation to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigValidationError);
			expect(error).toMatchObject({
				name: 'ConfigValidationError',
				issues: [
					{ path: 'app.name', message: 'app.name is required' },
					{ path: 'app.version', message: 'app.version is required' }
				]
			});
		}
	});
});
