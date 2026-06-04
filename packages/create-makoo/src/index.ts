#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { confirm, input, select } from '@inquirer/prompts';
import { generateReactTemplate } from './template/react-template';
import type { MakooFramework } from './template/types';
import { ansi, colorize, resolveDependencyMode } from './template/util';
import { generateVueTemplate } from './template/vue-template';

function commandExists(cmd: string): boolean {
	try {
		execSync(`which ${cmd}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function detectPackageManager(): string | null {
	const agent = process.env.npm_config_user_agent;
	if (agent) {
		if (agent.startsWith('npm')) return 'npm';
		if (agent.startsWith('pnpm')) return 'pnpm';
		if (agent.startsWith('yarn')) return 'yarn';
	}
	if (commandExists('pnpm')) return 'pnpm';
	if (commandExists('yarn')) return 'yarn';
	if (commandExists('npm')) return 'npm';
	return null;
}

function resolveTargetDir(projectName: string): string {
	return join(process.cwd(), projectName);
}

function isNonEmptyTargetDir(targetDir: string): boolean {
	if (!existsSync(targetDir)) {
		return false;
	}

	const stat = statSync(targetDir);
	if (!stat.isDirectory()) {
		throw new Error(
			`\x1b[31m\nTarget path "${targetDir}" exists and is not a directory.\x1b[0m`
		);
	}

	return readdirSync(targetDir).length > 0;
}

const theme = {
	prefix: { done: colorize('✓', ansi.green), loading: '⏳' },
	icon: { cursor: '▶', checked: colorize('✓', ansi.green), unchecked: '○' }
};
export async function createMakoo() {
	let pkgManager = detectPackageManager();
	console.log("\n🚀  Welcome to makoo! Let's set up your project.\n");
	try {
		const dependencyMode = resolveDependencyMode();

		const projectName: string = await input({
			message: '📁  Project name:',
			default: 'makoo-project',
			theme
		});
		const targetDir = resolveTargetDir(projectName);

		if (isNonEmptyTargetDir(targetDir)) {
			const directoryAction = await select({
				message: `Target directory "${projectName}" is not empty. Please choose how to proceed:`,
				choices: [
					{ name: 'Cancel operation', value: 'cancel' },
					{ name: 'Remove existing files and continue', value: 'remove' },
					{ name: 'Ignore files and continue', value: 'ignore' }
				],
				theme
			});

			if (directoryAction === 'cancel') {
				console.log(colorize('\n❌ Operation cancelled.', ansi.red));
				process.exit(0);
			}

			if (directoryAction === 'remove') {
				rmSync(targetDir, { recursive: true, force: true });
			}
		}

		const scriptName: string = await input({
			message: '📝  Userscript name (shown in @name):',
			default: projectName,
			theme
		});

		const version: string = await input({
			message: '📦  Version:',
			default: '0.0.1',
			theme
		});

		const nameSpace: string = await input({
			message: '🌐  Namespace:',
			default: 'npm/makoo',
			theme
		});

		const userScriptMatch: string = await input({
			message: '🎯  Match URL(s)  (comma-separated, e.g. https://example.com/*):',
			default: 'https://www.google.com/',
			theme
		});

		const variant: string = await select({
			message: '📘  Select a Variant:',
			choices: [
				{ name: colorize('TypeScript', ansi.blue), value: 'ts' },
				{ name: colorize('JavaScript', ansi.yellow), value: 'js' }
			],
			theme
		});

		const framework: MakooFramework = await select({
			message: '⚡  Select a framework:',
			choices: [
				{ name: colorize('Vue', ansi.green), value: 'Vue' },
				{ name: colorize('React', ansi.cyan), value: 'React' }
			],
			theme
		});

		const initData = {
			projectName,
			scriptName,
			version,
			nameSpace,
			userScriptMatch,
			variant,
			framework,
			dependencyMode
		};

		switch (framework) {
			case 'Vue':
				generateVueTemplate(initData);
				break;
			case 'React':
				generateReactTemplate(initData);
				break;
			default:
				throw new Error(colorize(`Unsupported framework: ${framework}`, ansi.red));
		}

		const installNow: boolean = await confirm({
			message: `📥  Install with ${pkgManager} and start now?`,
			default: true,
			theme
		});

		if (installNow) {
			if (!pkgManager) {
				pkgManager = await select({
					message: '📦 Select a package manager',
					choices: [
						{ name: 'pnpm', value: 'pnpm' },
						{ name: 'yarn', value: 'yarn' },
						{ name: 'npm', value: 'npm' }
					],
					theme
				});
			}

			console.log(`\n📦  Running ${pkgManager} install...\n`);
			execSync(`${pkgManager} install`, {
				stdio: 'inherit',
				cwd: join(process.cwd(), projectName)
			});
			console.log(`\n🎉  Done! Run: ${pkgManager} dev\n`);
		} else {
			console.log(`\n🎉  Done! Run '${pkgManager} install' then '${pkgManager} dev'\n`);
		}
	} catch (error: unknown) {
		if (error && typeof error === 'object' && (error as Error).name === 'ExitPromptError') {
			console.log(colorize('\n❌ Operation cancelled.', ansi.red));
			process.exit(0);
			return;
		}
		console.error(colorize(error instanceof Error ? error.message : String(error), ansi.red));
		process.exit(1);
		return;
	}
}

if (process.env.NODE_ENV !== 'test') {
	createMakoo();
}
