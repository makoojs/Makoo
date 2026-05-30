#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { confirm, input, select } from '@inquirer/prompts';
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

const theme = {
	prefix: { done: '\x1b[32m✓\x1b[0m', loading: '⏳' },
	icon: { cursor: '▶', checked: '\x1b[32m✓\x1b[0m', unchecked: '○' }
};

export async function createMakoo() {
	let pkgManager = detectPackageManager();
	console.log("\n🚀  Welcome to makoo! Let's set up your project.\n");
	try {
		const projectName: string = await input({
			message: '📁  Project name:',
			default: 'makoo-project',
			theme
		});

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
			default: 'http://tampermonkey.net',
			theme
		});

		const description: string = await input({
			message: '💬  Description:',
			default: '',
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
				{ name: 'TypeScript', value: 'ts' },
				{ name: 'JavaScript', value: 'js' }
			],
			theme
		});

		const framework: string = await select({
			message: '⚡  Select a framework:',
			choices: [
				{ name: 'Vue', value: 'Vue' },
				{ name: 'React', value: 'React' }
			],
			theme
		});

		generateVueTemplate({
			projectName,
			scriptName,
			version,
			nameSpace,
			description,
			userScriptMatch,
			variant,
			framework: framework as 'Vue' | 'React'
		});

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
			console.log('\x1b[31m\n❌ Operation cancelled.\x1b[0m');
			process.exit(0);
		}
		console.error(`\x1b[31m${error instanceof Error ? error.message : String(error)}\x1b[0m`);
		process.exit(1);
	}
}

createMakoo();
