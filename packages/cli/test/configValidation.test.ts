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

	it('rejects monkey.clientAlias and monkey.server.mountGmApi', () => {
		try {
			validateCliConfig({
				app: {
					name: 'demo-script',
					version: '1.0.0'
				},
				monkey: {
					clientAlias: '$',
					server: {
						mountGmApi: true
					}
				}
			});
			throw new Error('expected validation to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigValidationError);
			expect(error).toMatchObject({
				name: 'ConfigValidationError',
				issues: [
					{
						path: 'monkey.clientAlias',
						message: 'monkey.clientAlias is not supported by makoo'
					},
					{
						path: 'monkey.server.mountGmApi',
						message: 'monkey.server.mountGmApi is not supported by makoo'
					}
				]
			});
		}
	});

	it('rejects injector in CLI config', () => {
		try {
			validateCliConfig({
				app: {
					name: 'demo-script',
					version: '1.0.0'
				},
				injector: {
					alive: true
				}
			});
			throw new Error('expected validation to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigValidationError);
			expect(error).toMatchObject({
				name: 'ConfigValidationError',
				issues: [
					{
						path: 'injector',
						message:
							'injector is not supported in vite config; use manifest injectionDefaults instead'
					}
				]
			});
		}
	});
});
