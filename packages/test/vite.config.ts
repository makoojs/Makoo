import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
	root: import.meta.dirname,
	build: {
		outDir: 'dist',
		lib: {
			entry: {
				index: resolve(import.meta.dirname, 'src/index.ts'),
				metadata: resolve(import.meta.dirname, 'src/metadata.ts'),
				vitest: resolve(import.meta.dirname, 'src/vitest.ts'),
				playwright: resolve(import.meta.dirname, 'src/playwright.ts')
			},
			formats: ['es', 'cjs'],
			fileName: (format, entry) => `${entry}.${format === 'es' ? 'js' : 'cjs'}`
		},
		rolldownOptions: { external: [/^node:/, 'vitest', '@playwright/test', 'fflate'] }
	},
	plugins: [
		dts({
			clearPureImport: false,
			entryRoot: 'src',
			include: ['src/**/*.ts'],
			outDir: 'dist',
			tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json')
		})
	]
});
