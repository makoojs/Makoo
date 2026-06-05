import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
	root: __dirname,
	build: {
		outDir: 'dist',
		lib: {
			entry: {
				index: resolve(__dirname, 'src/index.ts'),
				'monkey/index': resolve(__dirname, 'src/monkey/index.ts')
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
		},
		rollupOptions: {
			treeshake: true,
			external: [
				'@makoojs/core',
				'jiti',
				'vite',
				'vite-plugin-monkey',
				'vite-plugin-monkey/dist/client',
				'node:fs',
				'node:path',
				'node:process'
			]
		}
	},
	plugins: [
		dts({
			entryRoot: 'src',
			include: ['src/**/*.ts'],
			rollupTypes: false,
			outDir: 'dist',
			tsconfigPath: resolve(__dirname, 'tsconfig.json')
		})
	]
});
