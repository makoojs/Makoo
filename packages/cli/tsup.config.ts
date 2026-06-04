import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/command/bin.ts'],
	format: ['esm'],
	noExternal: ['cac'],
	dts: false,
	clean: false,
	outDir: 'dist'
});
