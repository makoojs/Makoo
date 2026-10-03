import { describe, expect, it } from 'vitest';
import { createMakoo, ErrorCode, MakooError } from '../src';

describe('createMakoo', () => {
	it('should reject an empty declaration batch', () => {
		const makoo = createMakoo();

		expect(() => makoo.apply([])).toThrow(MakooError);
		expect(() => makoo.apply([])).toThrow(
			expect.objectContaining({ code: ErrorCode.INVALID_DECLARATION })
		);
	});

	it.each([
		['null', null],
		['a string', 'listener'],
		['an object without kind', {}]
	])('should reject %s as a declaration', (_label, declaration) => {
		const makoo = createMakoo();

		expect(() => Reflect.apply(makoo.apply, makoo, [[declaration]])).toThrow(
			expect.objectContaining({
				code: ErrorCode.INVALID_DECLARATION,
				issues: [expect.objectContaining({ path: 'kind' })]
			})
		);
	});
});
