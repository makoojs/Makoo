import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/commands/bin.ts'],
	format: ['esm'],
	noExternal: ['cac'],
	dts: false,
	clean: false,
	outDir: 'dist'
});
