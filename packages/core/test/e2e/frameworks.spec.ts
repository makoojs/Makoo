import { resolve } from 'node:path';
import { expect, test } from '@makoojs/test/playwright';
import { buildFrameworkFixture } from '../frameworks/buildFixture';

for (const framework of ['vue', 'react'] as const) {
	test.describe(framework, () => {
		test.use({
			managerPath: resolve(import.meta.dirname, '.cache/violentmonkey'),
			testPages: { '/counter': '<!doctype html><div id="app"></div>' },
			userscript: {
				build: ({ baseURL, outputDir }) =>
					buildFrameworkFixture(framework, outputDir, baseURL)
			}
		});
		test('compiled framework updates state after clicks', async ({ userscriptPage: page }) => {
			await page.goto('/counter');
			const counter = page.locator(`#${framework}-increment`);
			await expect(counter).toHaveCount(1);
			await expect(counter).toHaveText(framework === 'vue' ? 'Vue: 0' : 'React: 0');
			await counter.click();
			await expect(counter).toHaveText(framework === 'vue' ? 'Vue: 1' : 'React: 1');
			await counter.click();
			await expect(counter).toHaveText(framework === 'vue' ? 'Vue: 2' : 'React: 2');
		});
	});
}
