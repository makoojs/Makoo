import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResolvedSourceConfig } from '../src/config/type';
import { loadManifest } from '../src/scanner/load/loadManifes';
import { loadMeta } from '../src/scanner/load/loadMeta';
import { cleanupTempProjects, trackProject } from './utils/tempProject';

const sourceFor = (root: string): ResolvedSourceConfig => ({
	dir: path.join(root, 'injections'),
	include: ['*'],
	exclude: [],
	manifest: 'manifest'
});

afterEach(cleanupTempProjects);

describe('loadManifest', () => {
	it('throws MakooError when source directory does not exist', async () => {
		const root = await trackProject({ 'package.json': '{}' });

		await expect(loadManifest(sourceFor(root))).rejects.toThrow('Source directory not found');
	});

	it('loads manifest file and reads fresh content on repeated loads', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				export default {
					injections: [{ name: 'widget', injectAt: '#old', component: './widget.tsx', framework: 'React' }]
				};
			`
		});
		const manifestFile = path.join(root, 'injections/manifest.ts');

		const first = await loadManifest(sourceFor(root));
		expect(first?.manifestFile).toBe(manifestFile);
		expect(first?.manifest).toMatchObject({
			injections: [{ name: 'widget', injectAt: '#old' }]
		});

		await writeFile(
			manifestFile,
			`
				export default {
					injections: [{ name: 'widget', injectAt: '#new', component: './widget.tsx', framework: 'React' }]
				};
			`
		);
		const second = await loadManifest(sourceFor(root));
		expect(second?.manifest).toMatchObject({
			injections: [{ name: 'widget', injectAt: '#new' }]
		});
	});
});

describe('loadMeta', () => {
	it('returns null when module directory has no manifest file', async () => {
		const root = await trackProject({ 'injections/widget/index.tsx': 'export default null;' });

		await expect(loadMeta(path.join(root, 'injections/widget'))).resolves.toBeNull();
	});

	it('loads module manifest and reads fresh content on repeated loads', async () => {
		const root = await trackProject({
			'injections/widget/other.ts': 'export const value = 1;',
			'injections/widget/manifest.ts': `
				export default { name: 'widget', injectAt: '#old', component: './index.tsx', framework: 'React' };
			`
		});
		const moduleDir = path.join(root, 'injections/widget');
		const manifestFile = path.join(moduleDir, 'manifest.ts');

		const first = await loadMeta(moduleDir);
		expect(first?.overridePath).toBe(manifestFile);
		expect(first?.moduleConfig).toMatchObject({ name: 'widget', injectAt: '#old' });

		await writeFile(
			manifestFile,
			`export default { name: 'widget', injectAt: '#new', component: './index.tsx', framework: 'React' };`
		);
		const second = await loadMeta(moduleDir);
		expect(second?.moduleConfig).toMatchObject({ name: 'widget', injectAt: '#new' });
	});
});
