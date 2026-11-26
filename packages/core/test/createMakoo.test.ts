import { describe, expect, it } from 'vitest';
import { createMakoo, MakooError } from '../src';

describe('createMakoo', () => {
	it('should reject an empty declaration batch', () => {
		const makoo = createMakoo();

		expect(() => makoo.apply([])).toThrow(MakooError);
		expect(() => makoo.apply([])).toThrow(
			expect.objectContaining({ code: 'MAKOO_DECLARATION_INVALID' })
		);
	});
});
