import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
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
			external: ['@makoo/core', 'vue']
		}
	},
	plugins: [
		vue(),
		dts({
			entryRoot: 'src',
			include: ['src/**/*.ts'],
			rollupTypes: false,
			outDir: 'dist',
			tsconfigPath: resolve(__dirname, 'tsconfig.json')
		})
	]
});
