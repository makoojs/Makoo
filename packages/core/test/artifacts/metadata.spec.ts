import { describe, expect, it } from 'vitest';
import { MetadataParseError, parseMetadata } from '../../../test/src/metadata';

describe('userscript metadata', () => {
	it('preserves repeated, localized, empty and unknown fields with source locations', () => {
		const source =
			'\uFEFF\r\n// ==UserScript==\r\n// @name 测试\r\n// @name:zh-CN 中文名\r\n// @match https://one.test/*\r\n// @match https://two.test/*\r\n// @noframes\r\n// @custom a  b\r\n// @__proto__ safe\r\n// ==/UserScript==\r\nconsole.log("body");';
		const metadata = parseMetadata(source);
		expect(metadata.fields.name).toEqual(['测试']);
		expect(metadata.fields['name:zh-CN']).toEqual(['中文名']);
		expect(metadata.fields.match).toEqual(['https://one.test/*', 'https://two.test/*']);
		expect(metadata.fields.noframes).toEqual(['']);
		expect(metadata.fields.custom).toEqual(['a  b']);
		expect(metadata.fields.__proto__).toEqual(['safe']);
		const localized = metadata.entries[1];
		expect(localized.line).toBe(4);
		expect(source.slice(localized.start, localized.end)).toBe('// @name:zh-CN 中文名');
		expect(source.slice(metadata.start, metadata.end)).toMatch(
			/^\/\/ ==UserScript==[\s\S]*==\/UserScript==$/
		);
	});

	it('stops at the closing marker and does not parse markers in the JavaScript body', () => {
		const metadata = parseMetadata(
			'// ==UserScript==\n// @name one\n// ==/UserScript==\nconst template = `\n// ==UserScript==\n// @name fake\n// ==/UserScript==`;'
		);
		expect(metadata.fields.name).toEqual(['one']);
	});

	it.each([
		['console.log(1);', 'MISSING_METADATA', 1],
		['// ==UserScript==\n// @name test', 'UNCLOSED_METADATA', 1],
		['// ==UserScript==\n// ==UserScript==', 'INVALID_METADATA_LINE', 2],
		['// ==UserScript==\nalert(1);\n// ==/UserScript==', 'INVALID_METADATA_LINE', 2]
	])('reports structural failure for %s', (source, code, line) => {
		expect(() => parseMetadata(source)).toThrow(MetadataParseError);
		try {
			parseMetadata(source);
		} catch (error) {
			expect(error).toMatchObject({ code, line, offset: expect.any(Number) });
		}
	});
});
