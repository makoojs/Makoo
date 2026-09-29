import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	testMatch: 'browser.case.ts',
	workers: 1,
	retries: 0,
	timeout: 60_000
});
