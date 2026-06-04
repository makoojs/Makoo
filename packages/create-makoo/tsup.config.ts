import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['cjs'],
	noExternal: ['@inquirer/prompts'],
	dts: false,
	clean: true,
	outDir: 'dist',
	treeshake: true
});
