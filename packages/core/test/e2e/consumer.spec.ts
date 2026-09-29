import { resolve } from 'node:path';
import { expect, test } from '@makoojs/test/playwright';
import { buildConsumerFixture } from '../consumer/buildFixture';

test.use({
	managerPath: resolve(import.meta.dirname, '.cache/violentmonkey'),
	testPages: {
		'/counter':
			'<!doctype html><button id="increment">Increment</button><output id="count">0</output>'
	},
	userscript: { build: ({ baseURL, outputDir }) => buildConsumerFixture(baseURL, outputDir) }
});

test('installed core tarball produces a working userscript', async ({ userscriptPage: page }) => {
	await page.goto('/counter');
	await expect(page.locator('html')).toHaveAttribute('data-consumer-ready', 'true');
	await expect(page.locator('#count')).toHaveText('0');
	await page.locator('#increment').click();
	await expect(page.locator('#count')).toHaveText('1');
	await page.locator('#increment').click();
	await expect(page.locator('#count')).toHaveText('2');
});
