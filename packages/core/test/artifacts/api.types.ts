import type { UserscriptArtifact } from '@makoojs/test';
import '@makoojs/test/vitest';
import { expect as browserExpect, test } from '@makoojs/test/playwright';
import { expect } from 'vitest';

export async function checkArtifactTypes(artifact: UserscriptArtifact) {
	expect(artifact).toHaveGrant('GM_getValue');
	expect(artifact).toHaveClassicScriptSyntax();
	// @ts-expect-error syntax matcher accepts no arguments
	expect(artifact).toHaveClassicScriptSyntax('module');
	expect(artifact).not.toHaveMetadata('missing');
	await expect(Promise.resolve(artifact)).resolves.toHaveMetadataValues('match', ['a']);
	// @ts-expect-error grant must be a string
	expect(artifact).toHaveGrant(123);
	// @ts-expect-error metadata values must be strings
	expect(artifact).toHaveMetadataValues('match', [123]);
}

test.use({ manager: 'violentmonkey', userscript: 'demo.user.js' });
test.use({
	userscript: {
		build: async ({ baseURL, outputDir }) => `${outputDir}/${baseURL.length}.user.js`
	}
});
// @ts-expect-error unsupported manager
test.use({ manager: 'unknown' });
test('page types', async ({ userscriptPage }) => {
	await userscriptPage.goto('/');
	await browserExpect(userscriptPage.getByText('ready')).toBeVisible();
});
