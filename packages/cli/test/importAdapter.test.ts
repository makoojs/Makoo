import { describe, expect, it } from 'vitest';
import { renderImportAdapter } from '../src/generator/render/import/importAdapter';

describe('renderImportAdapter', () => {
	it('deduplicates adapter imports across injections', () => {
		const result = renderImportAdapter([
			{ framework: 'React' },
			{ framework: 'Vue' },
			{ framework: 'React' }
		] as never);

		expect(result.code).toContain('import { createReactAdapter } from "@makoo/react";');
		expect(result.code).toContain('import { createVueAdapter } from "@makoo/vue";');
		expect(result.importsName).toEqual(['React', 'Vue']);
	});

	it('skips unknown frameworks gracefully in the runtime switch fallback', () => {
		const result = renderImportAdapter([{ framework: 'Solid' }] as never);

		expect(result.code).toBe('');
		expect(result.importsName).toEqual(['Solid']);
	});
});
