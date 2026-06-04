import { describe, expect, it } from 'vitest';
import { renderInlineValue } from '../src/generator/render/util/value';

describe('renderInlineValue', () => {
	it('preserves functions and serializes nested values recursively', () => {
		const beforeMount = function beforeMount() {
			return 'mounted';
		};
		const rendered = renderInlineValue({
			alive: true,
			scope: 'global',
			timeout: 100,
			skipped: undefined,
			hooks: {
				beforeMount
			},
			list: [1, 'two', { callback: () => 'ok' }]
		});

		expect(rendered).toContain('"alive":true');
		expect(rendered).toContain('"scope":"global"');
		expect(rendered).toContain('"timeout":100');
		expect(rendered).not.toContain('skipped');
		expect(rendered).toContain('"beforeMount":(function beforeMount()');
		expect(rendered).toContain('"list":[1,"two",{"callback":(() => "ok")}]');
	});
});
