import { MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CliErrorCode } from '../../src/config/errors';
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

	it('publishes the CLI config error code', () => {
		expect(CliErrorCode.CLI_CONFIG_INVALID).toBe('MAKOO_CLI_CONFIG_INVALID');
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
		let thrown: unknown;
		try {
			validateCliConfig(config);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(MakooError);
		expect(thrown).toMatchObject({
			code: CliErrorCode.CLI_CONFIG_INVALID,
			message: expect.stringContaining(`${path}:`)
		});
		expect((thrown as MakooError).cause).toBeInstanceOf(ZodError);
	});
});
