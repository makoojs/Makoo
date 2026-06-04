import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { InitData } from '../src/template/types';
import { generateVueTemplate } from '../src/template/vue-template';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

function createInitData(variant: 'ts' | 'js', dependencyMode: 'npm' | 'local' = 'npm'): InitData {
	return {
		projectName: 'demo-app',
		scriptName: 'demo-app',
		version: '0.0.1',
		nameSpace: 'npm/makoo',
		userScriptMatch: 'https://example.com/*',
		variant,
		framework: 'Vue',
		dependencyMode
	};
}

describe('generateVueTemplate', () => {
	it('creates Vue TypeScript tsconfig files', async () => {
		const root = await trackProject({});

		await withCwd(root, async () => {
			generateVueTemplate(createInitData('ts'));

			const projectRoot = path.join(root, 'demo-app');
			const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
			const appTsconfigPath = path.join(projectRoot, 'tsconfig.app.json');
			const nodeTsconfigPath = path.join(projectRoot, 'tsconfig.node.json');
			const envPath = path.join(projectRoot, 'env.d.ts');
			const gitignorePath = path.join(projectRoot, '.gitignore');
			const packageJsonPath = path.join(projectRoot, 'package.json');
			const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
			const vueAssetPath = path.join(projectRoot, 'assets', 'vue.svg');
			const makooAssetPath = path.join(projectRoot, 'assets', 'makoo-icon-transparent.png');
			const appPath = path.join(projectRoot, 'injections', 'hello-world', 'app.vue');

			expect(existsSync(tsconfigPath)).toBe(true);
			expect(existsSync(appTsconfigPath)).toBe(true);
			expect(existsSync(nodeTsconfigPath)).toBe(true);
			expect(existsSync(envPath)).toBe(true);
			expect(existsSync(gitignorePath)).toBe(true);
			expect(existsSync(vueAssetPath)).toBe(true);
			expect(existsSync(makooAssetPath)).toBe(true);

			expect(readFileSync(tsconfigPath, 'utf-8')).toContain('./tsconfig.app.json');
			expect(readFileSync(appTsconfigPath, 'utf-8')).toContain('injections/**/*.vue');
			expect(readFileSync(appTsconfigPath, 'utf-8')).toContain('"skipLibCheck": true');
			expect(readFileSync(nodeTsconfigPath, 'utf-8')).toContain('vite.config.ts');
			expect(readFileSync(nodeTsconfigPath, 'utf-8')).toContain('"skipLibCheck": true');
			expect(readFileSync(gitignorePath, 'utf-8')).toContain('pnpm-debug.log*');
			expect(readFileSync(gitignorePath, 'utf-8')).toContain('!.vscode/extensions.json');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"typecheck": "vue-tsc -b"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@types/node": "^25.9.1"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@makoo/core": "^0.1.0"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@makoo/vue": "^0.1.0"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@makoo/cli": "^0.1.0"');
			expect(readFileSync(viteConfigPath, 'utf-8')).not.toContain('dedupe: [\'vue\']');
			expect(readFileSync(appPath, 'utf-8')).toContain(
				'../../assets/makoo-icon-transparent.png'
			);
			expect(readFileSync(appPath, 'utf-8')).toContain('<h1>Makoo</h1>');
		});
	});

	it('skips tsconfig files for Vue JavaScript projects', async () => {
		const root = await trackProject({});

		await withCwd(root, async () => {
			generateVueTemplate(createInitData('js'));

			const projectRoot = path.join(root, 'demo-app');
			expect(existsSync(path.join(projectRoot, 'tsconfig.json'))).toBe(false);
			expect(existsSync(path.join(projectRoot, 'tsconfig.app.json'))).toBe(false);
			expect(existsSync(path.join(projectRoot, 'tsconfig.node.json'))).toBe(false);
			expect(existsSync(path.join(projectRoot, 'env.d.ts'))).toBe(false);
			expect(existsSync(path.join(projectRoot, '.gitignore'))).toBe(true);
			expect(existsSync(path.join(projectRoot, 'assets', 'vue.svg'))).toBe(true);
			expect(existsSync(path.join(projectRoot, 'assets', 'makoo-icon-transparent.png'))).toBe(
				true
			);
		});
	});

	it('adds local resolve dedupe for Vue debug projects', async () => {
		const root = await trackProject({});

		await withCwd(root, async () => {
			generateVueTemplate(createInitData('ts', 'local'));

			const viteConfigPath = path.join(root, 'demo-app', 'vite.config.ts');
			const packageJsonPath = path.join(root, 'demo-app', 'package.json');

			expect(readFileSync(viteConfigPath, 'utf-8')).toContain("dedupe: ['vue']");
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('/packages/vue');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('/packages/core');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('/packages/cli');
		});
	});
});
