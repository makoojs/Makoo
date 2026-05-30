import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

export type InitData = {
	projectName: string;
	scriptName: string;
	version: string;
	nameSpace: string;
	description: string;
	userScriptMatch: string;
	variant: string;
	framework: 'Vue' | 'React';
};

function packageJsonTemplate(data: InitData): string {
	const devDeps: Record<string, string> = {
		vite: '^8.0.14'
	};

	if (data.variant === 'ts') {
		devDeps.typescript = '~5.9.3';
	}
	if (data.framework === 'Vue' && data.variant === 'ts') {
		devDeps['vue-tsc'] = '^3.1.5';
	}

	const deps: Record<string, string> = {};
	if (data.framework === 'Vue') {
		deps.vue = '^3.5.0';
	}

	const obj = {
		name: data.projectName,
		version: data.version,
		type: 'module',
		scripts: {
			dev: 'makoo dev',
			build: 'makoo build'
		},
		dependencies: deps,
		devDependencies: devDeps
	};

	return `${JSON.stringify(obj, null, 2)}\n`;
}

function viteConfigTemplate(data: InitData): string {
	const matches = data.userScriptMatch
		.split(',')
		.map((s) => `'${s.trim()}'`)
		.join(', ');

	const descriptionLine = data.description ? `\n        description: '${data.description}',` : '';

	return `import { defineConfig } from 'vite';
import { makoo } from '@makoo/cli';

export default defineConfig({
  plugins: [
    makoo({
      app: {
        name: '${data.scriptName}',
        version: '${data.version}',${descriptionLine}
      },
      monkey: {
        userscript: {
          icon: 'https://vitejs.dev/logo.svg',
          namespace: '${data.nameSpace}',
          match: [${matches}],
        },
      },
    }),
  ],
});
`;
}

function manifestTemplate(): string {
	return `import type { InjectionManifest } from '@makoo/cli';

export default {
  injections: {
    'hello-world': {
      injectAt: '#app',
      component: './hello-world/app.vue',
    },
  },
} satisfies InjectionManifest;
`;
}

function vueComponentTemplate(data: InitData): string {
	return `<script setup${data.variant === 'ts' ? ' lang="ts"' : ''}>
// ${data.scriptName} — hello-world injection
</script>

<template>
  <div class="makoo-hello-world">
    <h1>Hello from makoo! 🐒</h1>
  </div>
</template>

<style scoped>
.makoo-hello-world {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-family: sans-serif;
  z-index: 9999;
}
</style>
`;
}

export function generateVueTemplate(data: InitData): void {
	const root = join(process.cwd(), data.projectName);
	const injectionsDir = join(root, 'injections');
	const moduleDir = join(injectionsDir, 'hello-world');

	if (!existsSync(injectionsDir)) {
		mkdirSync(injectionsDir, { recursive: true });
	}
	if (!existsSync(moduleDir)) {
		mkdirSync(moduleDir, { recursive: true });
	}

	const ext = data.variant;

	writeFileSync(join(root, 'package.json'), packageJsonTemplate(data), 'utf-8');
	writeFileSync(join(root, `vite.config.${ext}`), viteConfigTemplate(data), 'utf-8');
	writeFileSync(join(injectionsDir, `manifest.${ext}`), manifestTemplate(), 'utf-8');
	writeFileSync(join(moduleDir, 'app.vue'), vueComponentTemplate(data), 'utf-8');
}
