import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateReactTemplate } from '../src/template/react-template';
import type { InitData } from '../src/template/type';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

afterEach(cleanupTempProjects);

function createInitData(variant: 'ts' | 'js', dependencyMode: 'npm' | 'local' = 'npm'): InitData {
	return {
		projectName: 'demo-react-app',
		scriptName: 'demo-react-app',
		version: '0.0.1',
		nameSpace: 'npm/makoo',
		userScriptMatch: 'https://example.com/*',
		variant,
		framework: 'React',
		dependencyMode
	};
}

describe('generateReactTemplate', () => {
	it('creates React TypeScript template files', async () => {
		const root = await trackProject({});

		await withCwd(root, async () => {
			generateReactTemplate(createInitData('ts'));

			const projectRoot = path.join(root, 'demo-react-app');
			const packageJsonPath = path.join(projectRoot, 'package.json');
			const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
			const appTsconfigPath = path.join(projectRoot, 'tsconfig.app.json');
			const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
			const reactAssetPath = path.join(projectRoot, 'assets', 'react.svg');
			const makooAssetPath = path.join(projectRoot, 'assets', 'makoo-icon-transparent.png');
			const appPath = path.join(projectRoot, 'injections', 'hello-world', 'app.tsx');
			const stylePath = path.join(projectRoot, 'injections', 'hello-world', 'style.css');

			expect(existsSync(packageJsonPath)).toBe(true);
			expect(existsSync(tsconfigPath)).toBe(true);
			expect(existsSync(appTsconfigPath)).toBe(true);
			expect(existsSync(reactAssetPath)).toBe(true);
			expect(existsSync(makooAssetPath)).toBe(true);
			expect(existsSync(stylePath)).toBe(true);

			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@vitejs/plugin-react"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@types/react": "^19.2.15"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@makoo/core": "^1.3.1"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@makoo/react": "^1.3.1"');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('"@makoo/cli": "^1.3.1"');
			expect(readFileSync(appTsconfigPath, 'utf-8')).toContain('"jsx": "react-jsx"');
			expect(readFileSync(viteConfigPath, 'utf-8')).not.toContain(
				"dedupe: ['react', 'react-dom']"
			);
			expect(readFileSync(appPath, 'utf-8')).toContain('../../assets/react.svg');
			expect(readFileSync(appPath, 'utf-8')).toContain('count is {count}');
			expect(readFileSync(stylePath, 'utf-8')).toContain('.logo-react');
		});
	});

	it('creates React JavaScript template files without tsconfig', async () => {
		const root = await trackProject({});

		await withCwd(root, async () => {
			generateReactTemplate(createInitData('js'));

			const projectRoot = path.join(root, 'demo-react-app');
			expect(existsSync(path.join(projectRoot, 'tsconfig.json'))).toBe(false);
			expect(existsSync(path.join(projectRoot, 'tsconfig.app.json'))).toBe(false);
			expect(existsSync(path.join(projectRoot, 'assets', 'react.svg'))).toBe(true);
			expect(existsSync(path.join(projectRoot, 'injections', 'hello-world', 'app.jsx'))).toBe(
				true
			);
			expect(existsSync(path.join(projectRoot, '.gitignore'))).toBe(true);
		});
	});

	it('adds local resolve dedupe for React debug projects', async () => {
		const root = await trackProject({});

		await withCwd(root, async () => {
			generateReactTemplate(createInitData('ts', 'local'));

			const viteConfigPath = path.join(root, 'demo-react-app', 'vite.config.ts');
			const packageJsonPath = path.join(root, 'demo-react-app', 'package.json');

			expect(readFileSync(viteConfigPath, 'utf-8')).toContain(
				"dedupe: ['react', 'react-dom']"
			);
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('/packages/react');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('/packages/core');
			expect(readFileSync(packageJsonPath, 'utf-8')).toContain('/packages/cli');
		});
	});
});
