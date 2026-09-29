import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@makoojs/test/playwright';
import { buildFixture } from './buildFixture';

const fault = process.env.MAKOO_E2E_FAULT;
if (fault && !['install', 'match', 'count'].includes(fault))
	throw new Error(`Unknown MAKOO_E2E_FAULT: ${fault}`);

test.use({
	manager: 'violentmonkey',
	managerPath: resolve(import.meta.dirname, '.cache/violentmonkey'),
	testPages: {
		'/counter': await readFile(resolve(import.meta.dirname, 'fixture/index.html'), 'utf8')
	},
	userscript: {
		build: async ({ baseURL, outputDir }) => {
			await buildFixture(baseURL, outputDir, fault === 'match');
			return resolve(outputDir, fault === 'install' ? 'missing.user.js' : 'counter.user.js');
		}
	}
});

test('compiled userscript counts clicks and cleans up listeners', async ({
	userscriptPage: page
}) => {
	await page.goto('/counter');
	await expect(page.locator('#page-state')).toHaveText('ready');
	await expect(page.locator('#script-state')).toHaveText('running');
	await expect(page.locator('#count')).toHaveText('0');
	await page.getByRole('button', { name: 'Increment' }).click();
	await expect(page.locator('#count')).toHaveText(fault === 'count' ? '999' : '1');
	await page.getByRole('button', { name: 'Increment' }).click();
	await expect(page.locator('#count')).toHaveText('2');
	await page.getByRole('button', { name: 'Dispose' }).click();
	await expect(page.locator('#script-state')).toHaveText('disposed');
	await page.getByRole('button', { name: 'Increment' }).click();
	await expect(page.locator('#observed-clicks')).toHaveText('3');
	await expect(page.locator('#count')).toHaveText('2');
	await page.getByRole('button', { name: 'Restart' }).click();
	await expect(page.locator('#script-state')).toHaveText('running');
	await page.getByRole('button', { name: 'Increment' }).click();
	await expect(page.locator('#count')).toHaveText('3');
});
