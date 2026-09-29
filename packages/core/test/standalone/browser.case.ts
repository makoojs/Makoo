import { resolve } from 'node:path';
import { expect, test } from '@makoojs/test/playwright';

test.use({
	userscript: resolve(import.meta.dirname, 'demo.user.js'),
	testPages: { '/counter': '<!doctype html><title>Counter</title><body></body>' }
});

test('updates the standalone counter', async ({ userscriptPage }) => {
	await userscriptPage.goto('/counter');
	await userscriptPage.getByRole('button', { name: 'Count: 0', exact: true }).click();
	await expect(userscriptPage.getByRole('button', { name: 'Count: 1' })).toBeVisible();
});
