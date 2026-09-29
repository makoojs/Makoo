import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@makoojs/test/vitest': resolve(import.meta.dirname, '../../../test/dist/vitest.js'),
			'@makoojs/test': resolve(import.meta.dirname, '../../../test/dist/index.js')
		}
	},
	test: {
		name: 'core-artifacts',
		environment: 'node',
		include: ['packages/core/test/artifacts/*.spec.ts'],
		testTimeout: 15_000
	}
});
