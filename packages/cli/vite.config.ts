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
				'monkey/index': resolve(import.meta.dirname, 'src/monkey/index.ts'),
				'bridge/runtime': resolve(import.meta.dirname, 'src/bridge/runtime.ts')
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
		},
		rollupOptions: {
			treeshake: true,
			external: [
				'@makoojs/core',
				'vite',
				'vite-plugin-monkey',
				'vite-plugin-monkey/dist/client',
				/^devframe(\/.*)?$/,
				/^node:/
			]
		}
	},
	plugins: [
		dts({
			entryRoot: 'src',
			include: ['src/**/*.ts'],
			rollupTypes: false,
			outDir: 'dist',
			tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json')
		})
	]
});
