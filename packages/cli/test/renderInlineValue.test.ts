import { ErrorCode, MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import { renderInlineValue } from '../src/generator/render/util/value';

describe('renderInlineValue', () => {
	it('serializes nested data recursively', () => {
		const rendered = renderInlineValue({
			alive: true,
			scope: 'global',
			timeout: 100,
			skipped: undefined,
			list: [1, 'two', { enabled: false }]
		});

		expect(rendered).toContain('"alive":true');
		expect(rendered).toContain('"scope":"global"');
		expect(rendered).toContain('"timeout":100');
		expect(rendered).not.toContain('skipped');
		expect(rendered).toContain('"list":[1,"two",{"enabled":false}]');
	});

	it('rejects functions that do not use manifest bindings', () => {
		let error: unknown;
		try {
			renderInlineValue({ nested: { callback: () => 'invalid' } });
		} catch (cause) {
			error = cause;
		}

		expect(error).toBeInstanceOf(MakooError);
		expect(error).toMatchObject({
			code: ErrorCode.CLI_FUNCTION_SERIALIZATION_UNSUPPORTED,
			name: 'FunctionSerializationError'
		});
	});
});
