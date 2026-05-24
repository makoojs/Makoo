import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '@makoo/core';
import { resolveConfig } from '../src/config/resolve';
import { MakooError } from '../src/scanner/error';
import { scanner } from '../src/scanner/scanner';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

describe('scanner', () => {
	it('throws when top-level manifest is missing', async () => {
		const root = await trackProject({
			'injections/widget/manifest.ts': `
				export default { name: 'widget', injectAt: '#app', component: './index.tsx', framework: 'React' };
			`,
			'injections/widget/index.tsx': 'export default function Widget() { return null; }'
		});
		const config = resolveConfig(
			{
				app: { name: 'missing-manifest', version: '0.0.1' }
			},
			root
		);

		const err = await withCwd(root, () => scanner(config)).catch((e) => e);
		expect(err).toBeInstanceOf(MakooError);
		expect((err as MakooError).code).toBe(ErrorCode.CLI_MANIFEST_NOT_FOUND);
		expect(err.message).toContain('No manifest found');
	});

	it('throws CLI_NO_ENABLED_INJECTIONS when all injections are disabled', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				export default {
					injections: [
						{ name: 'widget', injectAt: '#app', component: './widget/index.tsx', framework: 'React', enabled: false }
					]
				};
			`,
			'injections/widget/index.tsx': 'export default function Widget() { return null; }'
		});
		const config = resolveConfig(
			{
				app: { name: 'all-disabled', version: '0.0.1' }
			},
			root
		);

		const err = await withCwd(root, () => scanner(config)).catch((e) => e);
		expect(err).toBeInstanceOf(MakooError);
		expect((err as MakooError).code).toBe(ErrorCode.CLI_NO_ENABLED_INJECTIONS);
		expect(err.message).toContain('No enabled injections');
	});

	it('supports record manifest, module fallback names, overrides and source filters', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				export default {
					globalInjector: { timeout: 777 },
					injections: {
						fromManifest: { injectAt: 'body', component: './fromManifest/index.tsx', framework: 'React' },
						overridden: { injectAt: '#old', component: './overridden/old.tsx', framework: 'React', timeout: 1 }
					}
				};
			`,
			'injections/fromManifest/index.tsx':
				'export default function FromManifest() { return null; }',
			'injections/overridden/manifest.ts': `
				export default { injectAt: '#new', component: './index.tsx', framework: 'Vue', alive: true };
			`,
			'injections/overridden/index.tsx': 'export default { name: "Overridden" };',
			'injections/includedOnly/manifest.ts': `
				export default { injectAt: '#included', component: './index.tsx', framework: 'React' };
			`,
			'injections/includedOnly/index.tsx':
				'export default function IncludedOnly() { return null; }',
			'injections/skipMe/manifest.ts': `
				export default { injectAt: '#skip', component: './index.tsx', framework: 'React' };
			`,
			'injections/skipMe/index.tsx': 'export default function SkipMe() { return null; }'
		});
		const config = resolveConfig(
			{
				app: { name: 'scanner-record', version: '0.0.1' },
				source: {
					include: ['over*', 'included*', 'skip*'],
					exclude: ['skip*']
				}
			},
			root
		);

		const result = await withCwd(root, () => scanner(config));
		const modules = Object.fromEntries(
			result.injections.map((injection) => [injection.moduleId, injection])
		);

		expect(result.manifestFile).toBe(path.join(root, 'injections/manifest.ts'));
		expect(result.injections.map((injection) => injection.moduleId)).toEqual([
			'fromManifest',
			'includedOnly',
			'overridden'
		]);
		expect(modules.fromManifest).toMatchObject({
			injectAt: 'body',
			framework: 'React',
			timeout: 777
		});
		expect(modules.includedOnly).toMatchObject({
			injectAt: '#included',
			framework: 'React',
			timeout: 777
		});
		expect(modules.includedOnly.componentPath).toBe(
			path.join(root, 'injections/includedOnly/index.tsx')
		);
		expect(modules.overridden).toMatchObject({
			injectAt: '#new',
			framework: 'Vue',
			alive: true,
			timeout: 777
		});
		expect(modules.overridden.overridePath).toBe(
			path.join(root, 'injections/overridden/manifest.ts')
		);
		expect(modules.skipMe).toBeUndefined();
		expect(result.frameworks).toEqual(['React', 'Vue']);
	});
});
