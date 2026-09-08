// @vitest-environment node

import { type PreviewServer, preview } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewCommand } from '../../src/cli/commands/preview';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

vi.mock('vite', async (importOriginal) => {
	const vite = await importOriginal<typeof import('vite')>();
	return { ...vite, preview: vi.fn(vite.preview) };
});

let server: PreviewServer | undefined;
afterEach(async () => {
	await server?.close();
	await cleanupTempProjects();
	vi.clearAllMocks();
});

describe('previewCommand', () => {
	it('serves the selected output directory over HTTP', async () => {
		const root = await trackProject({
			'release/index.html': '<h1>preview release</h1>',
			'dist/index.html': '<h1>wrong directory</h1>'
		});
		try {
			await previewCommand({
				root,
				configFile: false,
				logLevel: 'silent',
				build: { outDir: 'release' },
				preview: { host: '127.0.0.1', port: 0, open: false }
			});
		} finally {
			// Keep the real server accessible for cleanup even if command setup fails.
			server = await vi.mocked(preview).mock.results[0]?.value;
		}
		const url = server?.resolvedUrls?.local[0];
		if (!url) throw new Error('Preview did not expose a local URL');
		const response = await fetch(url);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('preview release');
	});
});
