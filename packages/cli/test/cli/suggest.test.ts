import { describe, expect, it } from 'vitest';
import { suggestCommand } from '../../src/commands/suggest';

const COMMANDS = ['build', 'dev', 'preview'];

describe('suggestCommand', () => {
	it.each([
		['buid', 'build'],
		['buidl', 'build'],
		['dve', 'dev'],
		['previw', 'preview'],
		['prevew', 'preview']
	])('suggests %j as %j', (input, expected) => {
		expect(suggestCommand(input, COMMANDS)).toBe(expected);
	});

	it.each([['foo'], ['construction'], ['x'], ['']])('has no suggestion for %j', (input) => {
		expect(suggestCommand(input, COMMANDS)).toBeUndefined();
	});
});
