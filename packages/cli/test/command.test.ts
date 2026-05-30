import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	getExtName,
	moduleTemplate,
	reactTemplate,
	updateManifest,
	vueTemplate
} from '../src/command/_util';
import { addCommand } from '../src/command/add';
import { UnsupportedFrameworkGenerationError } from '../src/error/error';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

// --- getExtName ---

describe('getExtName', () => {
	it('returns .vue for Vue', () => {
		expect(getExtName('Vue')).toBe('.vue');
	});

	it('returns .jsx for React without tsconfig', async () => {
		const root = await trackProject({ 'dummy.txt': '' });
		await withCwd(root, async () => {
			expect(getExtName('React')).toBe('.jsx');
		});
	});

	it('returns .tsx for React with tsconfig.json', async () => {
		const root = await trackProject({ 'tsconfig.json': '{}' });
		await withCwd(root, async () => {
			expect(getExtName('React')).toBe('.tsx');
		});
	});

	it('returns null for unknown framework', () => {
		expect(getExtName('Svelte')).toBeNull();
	});
});

// --- moduleTemplate ---

describe('moduleTemplate', () => {
	it('returns vue template for Vue', () => {
		const result = moduleTemplate('Vue');
		expect(result).toContain('<template>');
		expect(result).toContain('hello-Vue');
	});

	it('returns react template for React', () => {
		const result = moduleTemplate('React');
		expect(result).toContain('export default function App()');
		expect(result).toContain('hello-React');
	});

	it('throws UnsupportedFrameworkGenerationError for unknown', () => {
		expect(() => moduleTemplate('Angular')).toThrow(UnsupportedFrameworkGenerationError);
		expect(() => moduleTemplate('Angular')).toThrow(/Angular/);
	});
});

// --- vueTemplate / reactTemplate ---

describe('vueTemplate', () => {
	it('returns valid SFC string', () => {
		const result = vueTemplate();
		expect(result).toContain('<template>');
		expect(result).toContain('</template>');
	});
});

describe('reactTemplate', () => {
	it('returns valid JSX string', () => {
		const result = reactTemplate();
		expect(result).toContain('export default function App()');
	});
});

// --- updateManifest ---

describe('updateManifest', () => {
	it('adds entry to object-form injections', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `import { defineInjections } from '@makoo/cli';
export default defineInjections({
  injections: {
    header: {
      injectAt: 'body',
      component: './header/App.vue'
    }
  }
});`
		});

		await withCwd(root, async () => {
			await updateManifest('footer', { injectAt: '#footer', component: './footer/App.vue' });

			const updated = readFileSync(path.join(root, 'injections', 'manifest.ts'), 'utf-8');
			expect(updated).toContain('defineInjections');
			expect(updated).toContain('footer');
			expect(updated).toContain('#footer');
			expect(updated).toContain('header');
		});
	});

	it('adds entry to array-form injections', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `import { defineInjections } from '@makoo/cli';
export default defineInjections({
  injections: [
    { name: 'header', injectAt: 'body', component: './header/App.vue' }
  ]
});`
		});

		await withCwd(root, async () => {
			await updateManifest('footer', { injectAt: '#footer', component: './footer/App.vue' });

			const updated = readFileSync(path.join(root, 'injections', 'manifest.ts'), 'utf-8');
			expect(updated).toContain('defineInjections');
			expect(updated).toContain('footer');
			expect(updated).toContain('header');
		});
	});

	it('creates new manifest when none exists', async () => {
		const root = await trackProject({
			'injections/other.ts': 'export default {}'
		});

		await withCwd(root, async () => {
			await updateManifest('test', { injectAt: 'body', component: './test/App.vue' });

			const manifestPath = path.join(root, 'injections', 'manifest.ts');
			expect(existsSync(manifestPath)).toBe(true);

			const content = readFileSync(manifestPath, 'utf-8');
			expect(content).toContain('defineInjections');
			expect(content).toContain('test');
			expect(content).toContain('./test/App.vue');
		});
	});
});

// --- addCommand ---

describe('addCommand', () => {
	it('creates module dir and component file (Vue)', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `import { defineInjections } from '@makoo/cli';
export default defineInjections({ injections: {} });`
		});

		await withCwd(root, async () => {
			await addCommand('demo', 'Vue');

			const appPath = path.join(root, 'injections', 'demo', 'App.vue');
			expect(existsSync(appPath)).toBe(true);

			const content = readFileSync(appPath, 'utf-8');
			expect(content).toContain('<template>');
			expect(content).toContain('hello-Vue');
		});
	});

	it('creates module dir and component file (React)', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `import { defineInjections } from '@makoo/cli';
export default defineInjections({ injections: {} });`
		});

		await withCwd(root, async () => {
			await addCommand('demo', 'React');

			const appPath = path.join(root, 'injections', 'demo', 'App.jsx');
			expect(existsSync(appPath)).toBe(true);

			const content = readFileSync(appPath, 'utf-8');
			expect(content).toContain('export default function App()');
		});
	});

	it('throws UnsupportedFrameworkGenerationError for unknown framework', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `export default { injections: {} };`
		});

		await withCwd(root, async () => {
			await expect(addCommand('demo', 'Svelte')).rejects.toThrow(
				UnsupportedFrameworkGenerationError
			);
		});
	});

	it('throws ModuleAlreadyExistsError when module dir exists', async () => {
		const root = await trackProject({
			'injections/demo/App.vue': '<template>old</template>',
			'injections/manifest.ts': `export default { injections: {} };`
		});

		await withCwd(root, async () => {
			const { ModuleAlreadyExistsError } = await import('../src/error/error');
			await expect(addCommand('demo', 'Vue')).rejects.toThrow(ModuleAlreadyExistsError);
		});
	});

	it('updates manifest with new module entry', async () => {
		const root = await trackProject({
			'injections/manifest.ts': `import { defineInjections } from '@makoo/cli';
export default defineInjections({ injections: {} });`
		});

		await withCwd(root, async () => {
			await addCommand('widget', 'Vue');

			const manifest = readFileSync(path.join(root, 'injections', 'manifest.ts'), 'utf-8');
			expect(manifest).toContain('widget');
			expect(manifest).toContain('./widget/app.vue');
		});
	});
});
