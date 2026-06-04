import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
	root: __dirname,
	build: {
		outDir: 'dist',
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			formats: ['es', 'cjs'],
			fileName: 'index'
		},
		rollupOptions: {
			external: ['@makoo/core', 'react', 'react-dom', 'react-dom/client']
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
