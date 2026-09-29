import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: { include: ['artifact.case.ts'], environment: 'node' }
});
