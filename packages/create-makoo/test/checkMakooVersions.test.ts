import { describe, expect, it } from 'vitest';

const {
	buildExpectedVersions,
	compareRecommendedVersions,
	parseRecommendedVersions
} = await import('../../../.github/scripts/check-makoo-versions.mjs');

describe('check-makoo-versions', () => {
	it('builds recommended versions from pending Changesets releases', () => {
		expect(
			buildExpectedVersions([
				{ name: '@makoojs/core', newVersion: '0.2.1' },
				{ name: '@makoojs/cli', newVersion: '0.3.2' },
				{ name: '@makoojs/vue', newVersion: '0.1.2' },
				{ name: '@makoojs/react', newVersion: '0.1.2' },
				{ name: '@makoojs/create-makoo', newVersion: '0.1.4' }
			])
		).toEqual({
			core: '^0.2.1',
			cli: '^0.3.2',
			vue: '^0.1.2',
			react: '^0.1.2',
			'create-makoo': '^0.1.4'
		});
	});

	it('parses the recommendation table and reports mismatched entries', () => {
		const current = parseRecommendedVersions(`
export const recommendedMakooVersions = {
	core: '^0.2.0',
	cli: '^0.3.2',
	'create-makoo': '^0.1.4'
} as const satisfies Record<string, string>;
`);

		expect(
			compareRecommendedVersions(current, {
				core: '^0.2.1',
				cli: '^0.3.2',
				'create-makoo': '^0.1.4'
			})
		).toEqual([{ key: 'core', current: '^0.2.0', expected: '^0.2.1' }]);
	});
});
