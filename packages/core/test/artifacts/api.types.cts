import library = require('@makoojs/test');
import metadata = require('@makoojs/test/metadata');
import browser = require('@makoojs/test/playwright');

export const parsed: metadata.UserscriptMetadata = metadata.parseMetadata(
	'// ==UserScript==\n// ==/UserScript=='
);
export const pending: Promise<library.UserscriptArtifact> = library.readUserscript('demo.user.js');
browser.test.use({ userscript: 'demo.user.js', manager: 'violentmonkey' });
browser.test('CommonJS page types', async ({ userscriptPage }) => {
	await userscriptPage.goto('/');
	await browser.expect(userscriptPage.getByText('ready')).toBeVisible();
});
// @ts-expect-error file paths must be strings
library.readUserscript(123);
// @ts-expect-error metadata input must be a string
metadata.parseMetadata(123);
// @ts-expect-error unknown manager
browser.test.use({ manager: 'unknown' });
