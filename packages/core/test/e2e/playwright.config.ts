import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: import.meta.dirname,
	testMatch: '*.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: [['list'], ['html', { open: 'never' }]],
	outputDir: 'test-results'
});
