import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@makoo/core';
import {
	getExtName,
	loadCliVersion,
	moduleTemplate,
	reactTemplate,
	updateManifest,
	vueTemplate
} from '../src/command/_util';
import { addCommand } from '../src/command/add';
import { UnsupportedFrameworkGenerationError } from '../src/error/error';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

describe('loadCliVersion', () => {
	it('returns cached version without reading package files', async () => {
		await expect(loadCliVersion('9.9.9')).resolves.toBe('9.9.9');
	});

	it('resolves cli package version when cache is empty', async () => {
		const cliPackage = JSON.parse(
			readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
		) as { version: string };

		await expect(loadCliVersion(null)).resolves.toBe(cliPackage.version);
	});
});

describe('loadMakooConfig', () => {
	afterEach(() => {
		vi.doUnmock('vite');
		vi.resetModules();
	});

	it('returns resolved makoo config from vite plugin payload', async () => {
		vi.resetModules();
		const makooConfig = {
			app: { name: 'demo', version: '0.0.1' },
			source: { include: ['*'], exclude: [] },
			injector: { alive: false, scope: 'local', timeout: 5000 },
			monkey: { userscript: { match: ['https://example.com/*'] } }
		};
		const loadConfigFromFile = vi.fn().mockResolvedValue({
			path: '/tmp/vite.config.ts',
			config: {
				plugins: [[null, false, { name: 'vite-plugin-makoo', __makoo: makooConfig }]]
			}
		});

		vi.doMock('vite', () => ({
			loadConfigFromFile
		}));

		const util = await import('../src/command/_util');
		await expect(util.loadMakooConfig()).resolves.toBe(makooConfig);
		expect(loadConfigFromFile).toHaveBeenCalledWith(
			{ command: 'build', mode: 'production' },
			undefined,
			process.cwd()
		);
	});

	it('throws when vite config file is missing', async () => {
		vi.resetModules();
		vi.doMock('vite', () => ({
			loadConfigFromFile: vi.fn().mockResolvedValue(null)
		}));

		const util = await import('../src/command/_util');

		await expect(util.loadMakooConfig()).rejects.toMatchObject({
			name: 'LoadViteMakooConfigError',
			code: ErrorCode.CLI_VITE_CONFIG_NOT_FOUND
		});
	});

	it('throws when makoo plugin is not present in vite config', async () => {
		vi.resetModules();
		vi.doMock('vite', () => ({
			loadConfigFromFile: vi.fn().mockResolvedValue({
				path: '/tmp/vite.config.ts',
				config: {
					plugins: [{ name: 'vite:vue' }]
				}
			})
		}));

		const util = await import('../src/command/_util');

		await expect(util.loadMakooConfig()).rejects.toMatchObject({
			name: 'LoadViteMakooConfigError',
			code: ErrorCode.CLI_PLUGIN_NOT_FOUND
		});
	});
});

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
			await expect(addCommand('demo', 'Vue')).rejects.toMatchObject({
				name: 'ModuleAlreadyExistsError',
				code: ErrorCode.CLI_MODULE_ALREADY_EXISTS
			});
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

describe('devCommand', () => {
	it('prints makoo-style startup info and binds CLI shortcuts', async () => {
		vi.resetModules();
		const cliPackage = JSON.parse(
			readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
		) as { version: string };
		const listen = vi.fn().mockResolvedValue(undefined);
		const bindCLIShortcuts = vi.fn();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		const createServer = vi.fn().mockResolvedValue({
			listen,
			bindCLIShortcuts,
			resolvedUrls: {
				local: ['http://localhost:5173/'],
				network: []
			},
			config: {}
		});

		vi.doMock('vite', () => ({ createServer }));
		vi.doMock('../src/command/_util', async (importOriginal) => {
			const actual = await importOriginal<typeof import('../src/command/_util')>();
			return {
				...actual,
				loadCliVersion: vi.fn().mockResolvedValue(cliPackage.version)
			};
		});

		try {
			const { devCommand } = await import('../src/command/dev');
			await devCommand();

			expect(createServer).toHaveBeenCalled();
			expect(listen).toHaveBeenCalled();
			expect(log).toHaveBeenCalledWith(
				`\n\x1B[1m\x1B[36mMakoo v${cliPackage.version}\x1B[0m\n`
			);
			expect(log).toHaveBeenCalledWith(
				'  \x1B[32m➜\x1B[0m  \x1B[1mLocal:\x1B[0m   \x1B[36mhttp://localhost:5173/\x1B[0m'
			);
			expect(log).toHaveBeenCalledWith(
				'  \x1B[32m➜\x1B[0m  \x1B[1mNetwork:\x1B[0m \x1B[2muse --host to expose\x1B[0m'
			);
			expect(bindCLIShortcuts).toHaveBeenCalledWith({ print: true });
		} finally {
			log.mockRestore();
			vi.doUnmock('vite');
			vi.doUnmock('../src/command/_util');
			vi.resetModules();
		}
	});
});
