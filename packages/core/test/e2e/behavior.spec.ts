import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@makoojs/test/playwright';
import { type BehaviorFault, buildBehaviorFixture } from './buildBehaviorFixture';

const fault = process.env.MAKOO_BEHAVIOR_FAULT;
if (fault && !['disable-alive', 'remove-exclude', 'skip-storage-write'].includes(fault))
	throw new Error(`Unknown MAKOO_BEHAVIOR_FAULT: ${fault}`);
const behaviorFault = fault as BehaviorFault | undefined;
test.use({ managerPath: resolve(import.meta.dirname, '.cache/violentmonkey') });
const [aliveHtml, matchingHtml, storageHtml] = await Promise.all(
	['alive', 'matching', 'storage'].map((name) =>
		readFile(resolve(import.meta.dirname, `behavior/${name}.html`), 'utf8')
	)
);

test.describe('alive', () => {
	test.use({
		testPages: { '/alive': aliveHtml },
		userscript: {
			build: ({ baseURL, outputDir }) =>
				buildBehaviorFixture('alive', baseURL, outputDir, behaviorFault)
		}
	});
	test('remounts after host replacement and releases detached listeners', async ({
		userscriptPage: page
	}) => {
		await page.goto('/alive');
		await expect(page.locator('#page-state')).toHaveText('ready');
		await expect(page.locator('#mounts')).toHaveText('1');
		await page.locator('#alive-button').click();
		await expect(page.locator('#count')).toHaveText('1');
		for (let replacement = 1; replacement <= 2; replacement++) {
			await page.locator('#replace').click();
			await expect(page.locator('#mounts'), 'acceptance:alive-restored').toHaveText(
				String(replacement + 1)
			);
			await expect(page.locator('#unmounts')).toHaveText(String(replacement));
			await expect(page.locator('#alive-button')).toHaveCount(1);
			await page.locator('#probe').click();
			await expect(page.locator('#probes')).toHaveText(String(replacement));
			await expect(page.locator('#count')).toHaveText(String(replacement));
			await page.locator('#alive-button').click();
			await expect(page.locator('#count')).toHaveText(String(replacement + 1));
		}
	});
});

test.describe('matching', () => {
	test.use({
		testPages: {
			'/eligible/included': matchingHtml,
			'/eligible/excluded': matchingHtml,
			'/outside': matchingHtml
		},
		userscript: {
			build: ({ baseURL, outputDir }) =>
				buildBehaviorFixture('matching', baseURL, outputDir, behaviorFault)
		}
	});
	test('runs on matching pages and respects exclude and nonmatching paths', async ({
		userscriptPage: page
	}) => {
		await page.goto('/eligible/included');
		await expect(page.locator('#script-runs')).toHaveText('1');
		for (const path of ['/eligible/excluded', '/outside']) {
			await page.goto(path);
			await expect(page.locator('#page-state')).toHaveText('ready');
			await expect(page.locator('#observation-state')).toHaveText('complete');
			await expect(
				page.locator('#script-runs'),
				path === '/eligible/excluded'
					? 'acceptance:excluded-page'
					: 'acceptance:unmatched-page'
			).toHaveText('0');
		}
		await page.goto('/eligible/included');
		await expect(page.locator('#script-runs')).toHaveText('1');
	});
});

test.describe('storage', () => {
	test.use({
		testPages: { '/storage': storageHtml },
		userscript: {
			build: ({ baseURL, outputDir }) =>
				buildBehaviorFixture('storage', baseURL, outputDir, behaviorFault)
		}
	});
	for (const name of ['first isolated profile', 'second isolated profile']) {
		test(`persists across reloads in ${name}`, async ({ userscriptPage: page }) => {
			await page.goto('/storage');
			await expect(page.locator('#storage-state')).toHaveText('ready');
			await expect(page.locator('#count')).toHaveText('0');
			await page.locator('#increment').click();
			await expect(page.locator('#count')).toHaveText('1');
			await page.reload();
			await expect(page.locator('#storage-state')).toHaveText('ready');
			await expect(page.locator('#count'), 'acceptance:storage-restored').toHaveText('1');
			await page.locator('#increment').click();
			await expect(page.locator('#count')).toHaveText('2');
		});
	}
});
