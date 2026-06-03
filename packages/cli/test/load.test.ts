import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ErrorCode, MakooError } from '@makoo/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResolvedSourceConfig } from '../src/config/types';
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

		const err = await loadManifest(sourceFor(root)).catch((e) => e);
		expect(err).toBeInstanceOf(MakooError);
		expect(err.code).toBe(ErrorCode.CLI_SOURCE_DIR_NOT_FOUND);
		expect(err.message).toContain('Source directory not found');
	});

	it('throws MakooError with CLI_MANIFEST_LOAD_FAIL when manifest file throws on load', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `throw new Error('forced manifest load failure');`
		});

		const err = await loadManifest(sourceFor(root)).catch((e) => e);
		expect(err).toBeInstanceOf(MakooError);
		expect(err.code).toBe(ErrorCode.CLI_MANIFEST_LOAD_FAIL);
		expect(err.message).toContain('Failed to load manifest');
	});

	it('loads manifest file and reads fresh content on repeated loads', async () => {
		const root = await trackProject({
			'injections/hooks.ts': `import { helper } from './helper';
export const hooks = { 'run:start': () => helper() };`,
			'injections/helper.ts': `export const helper = () => 'hooked';`,
			'injections/manifest.ts': `
				import { hooks } from './hooks';
				export default {
					globalInjector: { hooks },
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
		expect(first?.dependencies).toEqual([
			path.join(root, 'injections/hooks.ts'),
			path.join(root, 'injections/helper.ts')
		]);

		await writeFile(
			manifestFile,
			`
				import { hooks } from './hooks';
				export default {
					globalInjector: { hooks },
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
	it('throws MakooError with CLI_MODULE_MANIFEST_LOAD_FAIL when module manifest throws on load', async () => {
		const root = await trackProject({
			'injections/widget/manifest.ts': `throw new Error('forced module manifest failure');`
		});

		const err = await loadMeta(path.join(root, 'injections/widget')).catch((e) => e);
		expect(err).toBeInstanceOf(MakooError);
		expect(err.code).toBe(ErrorCode.CLI_MODULE_MANIFEST_LOAD_FAIL);
		expect(err.message).toContain('Failed to load module manifest');
	});

	it('returns null when module directory has no manifest file', async () => {
		const root = await trackProject({ 'injections/widget/index.tsx': 'export default null;' });

		await expect(loadMeta(path.join(root, 'injections/widget'))).resolves.toBeNull();
	});

	it('loads module manifest and reads fresh content on repeated loads', async () => {
		const root = await trackProject({
			'injections/widget/other.ts': `import { helper } from './helper';
export const onMounted = () => helper();`,
			'injections/widget/helper.ts': `export const helper = () => 1;`,
			'injections/widget/manifest.ts': `
				import { onMounted } from './other';
				export default {
					name: 'widget',
					injectAt: '#old',
					component: './index.tsx',
					framework: 'React',
					onMounted
				};
			`
		});
		const moduleDir = path.join(root, 'injections/widget');
		const manifestFile = path.join(moduleDir, 'manifest.ts');

		const first = await loadMeta(moduleDir);
		expect(first?.overridePath).toBe(manifestFile);
		expect(first?.moduleConfig).toMatchObject({ name: 'widget', injectAt: '#old' });
		expect(first?.dependencies).toEqual([
			path.join(root, 'injections/widget/other.ts'),
			path.join(root, 'injections/widget/helper.ts')
		]);

		await writeFile(
			manifestFile,
			`import { onMounted } from './other';
			export default { name: 'widget', injectAt: '#new', component: './index.tsx', framework: 'React', onMounted };`
		);
		const second = await loadMeta(moduleDir);
		expect(second?.moduleConfig).toMatchObject({ name: 'widget', injectAt: '#new' });
	});
});
