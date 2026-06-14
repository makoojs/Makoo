import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectDependencies } from '../src/scanner/collectDependenics';
import { cleanupTempProjects, trackProject } from './utils/tempProject';

afterEach(cleanupTempProjects);

describe('collectDependencies', () => {
	it('collects recursive local dependencies without including package imports', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				import { hooks } from './hooks';
				export default { injectionDefaults: { hooks }, injections: {} };
			`,
			'injections/hooks.ts': `
				import { helper } from './nested/helper';
				import { debounce } from 'lodash';
				export const hooks = { 'run:start': () => debounce(helper, 10) };
			`,
			'injections/nested/helper.ts': `export const helper = () => 'ok';`
		});

		const dependencies = collectDependencies(path.join(root, 'injections/manifest.ts'), {
			root
		});

		expect(dependencies).toEqual([
			path.join(root, 'injections/hooks.ts'),
			path.join(root, 'injections/nested/helper.ts')
		]);
	});

	it('resolves directory index files, skips missing locals, and can include the entry file', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				import './hooks';
				import './missing';
				export default { injections: {} };
			`,
			'injections/hooks/index.ts': `
				export * from '../shared';
			`,
			'injections/shared.ts': `export const value = 'ok';`
		});

		const dependencies = collectDependencies(path.join(root, 'injections/manifest.ts'), {
			root,
			includeEntry: true
		});

		expect(dependencies).toEqual([
			path.join(root, 'injections/manifest.ts'),
			path.join(root, 'injections/hooks/index.ts'),
			path.join(root, 'injections/shared.ts')
		]);
	});

	it('collects local dependencies referenced through static require calls', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `
				const hooks = require('./hooks');
				module.exports = { injectionDefaults: { hooks }, injections: {} };
			`,
			'injections/hooks.js': `
				const helper = require('./helper');
				const external = require('lodash');
				module.exports = {
					'run:start': () => [helper(), Boolean(external)]
				};
			`,
			'injections/helper.js': `module.exports = () => 'ok';`
		});

		const dependencies = collectDependencies(path.join(root, 'injections/manifest.ts'), {
			root
		});

		expect(dependencies).toEqual([
			path.join(root, 'injections/hooks.js'),
			path.join(root, 'injections/helper.js')
		]);
	});
});
