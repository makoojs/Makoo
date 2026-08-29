import { describe, expect, it } from 'vitest';
import { ConfigValidationError, ErrorCode, toMakooIssue } from '../../src/config/errors';

describe('CLI errors', () => {
	it('uses the CLI config validation error code', () => {
		expect(new ConfigValidationError([]).code).toBe(ErrorCode.CLI_CONFIG_INVALID);
	});

	it('formats validation issue paths', () => {
		expect(toMakooIssue({ code: 'custom', path: ['entry'], message: 'is required' })).toEqual({
			path: 'entry',
			message: 'is required'
		});
	});
});
