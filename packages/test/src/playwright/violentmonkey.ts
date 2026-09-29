import { type BrowserContext, expect } from '@playwright/test';

export async function prepareViolentmonkey(context: BrowserContext) {
	const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
	const extensionId = new URL(worker.url()).host;
	const settings = await context.newPage();
	await settings.goto(`chrome://extensions/?id=${extensionId}`);
	const toggle = settings.locator('#allow-user-scripts cr-toggle');
	await expect(toggle).toBeVisible();
	if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await settings.close();
	return extensionId;
}

export async function installUserscript(context: BrowserContext, origin: string) {
	const installer = await context.newPage();
	await installer.goto(`${origin}/install`);
	await installer.getByRole('link', { name: 'Install userscript' }).click();
	await installer.waitForURL(/chrome-extension:\/\/[^/]+\/confirm\/index.html/);
	await expect(installer.locator('#confirm')).toBeEnabled();
	await installer.locator('#confirm').click();
	await expect(installer.locator('.status')).toContainText('installed', { ignoreCase: true });
	await installer.close();
}
