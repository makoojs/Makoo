import { parseMetadata, type UserscriptArtifact } from '@makoojs/test';
import { describe, expect, it } from 'vitest';
import '@makoojs/test/vitest';

function artifact(fields: string): UserscriptArtifact {
	const source = `// ==UserScript==\n${fields}\n// ==/UserScript==`;
	return { path: '/fixtures/demo.user.js', source, metadata: parseMetadata(source) };
}

describe('userscript matchers', () => {
	it('supports presence, containment, exact values, resources and negation', async () => {
		const file = artifact(
			'// @match a\n// @match b\n// @grant GM_getValue\n// @resource data   https://assets.test/data\n// @noframes'
		);
		expect(file).toHaveMetadata('noframes');
		expect(file).toHaveMetadata('noframes', '');
		expect(file).toHaveMetadata('match', 'a');
		expect(file).toHaveMetadataValues('match', ['a', 'b']);
		expect(file).not.toHaveMetadataValues('match', ['b', 'a']);
		expect(file).toHaveResource('data', 'https://assets.test/data');
		expect(file).not.toHaveGrant('unsafeWindow');
		await expect(Promise.resolve(file)).resolves.toHaveGrant('GM_getValue');
		expect(() => expect(file).not.toHaveGrant('GM_getValue')).toThrow('expected not @grant');
	});

	it('reports the file, field, source line and actual values', () => {
		const file = artifact('// @grant GM_setValue');
		expect(() => expect(file).toHaveGrant('GM_getValue')).toThrow(
			'/fixtures/demo.user.js (lines 2)'
		);
		expect(() => expect(file).toHaveGrant('GM_getValue')).toThrow('GM_setValue');
		expect(() => expect(file).toHaveMetadataValues('missing', [])).toThrow('@missing');
		expect(() => expect({}).not.toHaveGrant('GM_getValue')).toThrow(TypeError);
	});

	it('compares all fields independently of field order, preserving repeated value order', () => {
		const first = artifact('// @name demo\n// @match a\n// @match b');
		const second = artifact('// @match a\n// @match b\n// @name demo');
		expect(first).toHaveSameMetadataAs(second);
		const changed = artifact('// @name demo\n// @match b\n// @match a');
		expect(first).not.toHaveSameMetadataAs(changed);
		expect(() => expect(first).toHaveSameMetadataAs(changed)).toThrow('@match');
	});
});
