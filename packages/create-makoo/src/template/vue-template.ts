import { join } from 'node:path';
import process from 'node:process';
import type { InitData } from './types';
import {
	copyTemplateAssets,
	createTypeScriptConfigFiles,
	resolveMakooDependencies,
	writeGitignoreFile,
	writeTemplateFiles
} from './util';

function packageJsonTemplate(data: InitData): string {
	const devDeps: Record<string, string> = {
		vite: '^8.0.14'
	};

	if (data.variant === 'ts') {
		devDeps.typescript = '~5.9.3';
		devDeps['@types/node'] = '^25.9.1';
	}
	if (data.framework === 'Vue' && data.variant === 'ts') {
		devDeps['vue-tsc'] = '^3.1.5';
	}
	if (data.framework === 'Vue') {
		devDeps['@vitejs/plugin-vue'] = '^6.0.7';
	}

	const deps: Record<string, string> = {};
	if (data.framework === 'Vue') {
		deps.vue = '^3.5.0';
	}
	const makooDependencies = resolveMakooDependencies(data.framework, data.dependencyMode);

	const obj = {
		name: data.projectName,
		version: data.version,
		type: 'module',
		scripts: {
			dev: 'makoo dev',
			build: data.variant === 'ts' ? 'vue-tsc -b && makoo build' : 'makoo build',
			...(data.variant === 'ts' ? { typecheck: 'vue-tsc -b' } : {})
		},
		dependencies: {
			...deps,
			...makooDependencies.dependencies
		},
		devDependencies: {
			...devDeps,
			...makooDependencies.devDependencies
		}
	};

	return `${JSON.stringify(obj, null, 2)}\n`;
}

function viteConfigTemplate(data: InitData): string {
	const matches = data.userScriptMatch
		.split(',')
		.map((s) => `'${s.trim()}'`)
		.join(', ');
	const localResolveBlock =
		data.dependencyMode === 'local'
			? `  resolve: {
    dedupe: ['vue']
  },`
			: '';

	return `import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  ${localResolveBlock}
  plugins: [
    vue(),
    makoo({
      app: {
        name: '${data.scriptName}',
        version: '${data.version}'
      },
      monkey: {
        userscript: {
          icon: 'https://vitejs.dev/logo.svg',
          namespace: '${data.nameSpace}',
          match: [${matches}],
        },
        build: {
          externalGlobals: {
            vue: cdn.jsdelivr('Vue', 'dist/vue.global.min.js')
          }
        },
      },
    }),
  ],
});
`;
}

function manifestTemplate(): string {
	return `import { defineInjections } from '@makoojs/cli';

export default defineInjections({
  injections: {
    'hello-world': {
      injectAt: 'body',
      component: './hello-world/app.vue',
    }
  }
});
`;
}

function vueComponentTemplate(data: InitData): string {
	return `<script setup${data.variant === 'ts' ? ' lang="ts"' : ''}>
import { ref } from 'vue';
import makooLogo from '../../assets/makoo-icon-transparent.png';
import vueLogo from '../../assets/vue.svg';

const count = ref(0);
</script>

<template>
  <section class="makoo-hello-world">
    <div class="hero">
      <img :src="vueLogo" class="logo logo-vue" alt="Vue logo" />
      <span class="hero-plus">+</span>
      <img :src="makooLogo" class="logo logo-makoo" alt="Makoo logo" />
    </div>

    <div class="content">
      <h1>Makoo</h1>
      <p>Edit <code>app.vue</code> and save to test HMR.</p>
    </div>

    <button type="button" class="counter" @click="count += 1">
      count is {{ count }}
    </button>
  </section>
</template>

<style scoped>
.makoo-hello-world {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  gap: 1.5rem;
  width: min(520px, calc(100vw - 32px));
  padding: 2rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 247, 250, 0.96));
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 24px;
  box-shadow:
    0 20px 45px rgba(15, 23, 42, 0.18),
    0 4px 12px rgba(15, 23, 42, 0.08);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  text-align: center;
  z-index: 9999;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.logo {
  display: block;
  object-fit: contain;
  filter: drop-shadow(0 10px 18px rgba(15, 23, 42, 0.14));
  transition: transform 0.25s ease;
}

.logo:hover {
  transform: translateY(-3px) scale(1.03);
}

.logo-vue {
  width: 80px;
  height: 80px;
}

.logo-makoo {
  width: 92px;
  height: 92px;
}

.hero-plus {
  color: #1f2937;
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
}

.content {
  display: grid;
  gap: 0.75rem;
}

.content h1 {
  margin: 0;
  color: #111827;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  line-height: 1.05;
}

.content p {
  margin: 0;
  color: #4b5563;
  font-size: 1rem;
  line-height: 1.6;
}

.content code {
  padding: 0.2rem 0.45rem;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 999px;
  color: #111827;
  font-size: 0.95em;
}

.counter {
  justify-self: center;
  min-width: 180px;
  padding: 0.9rem 1.2rem;
  background: linear-gradient(135deg, #42b883, #35495e);
  color: #fff;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 12px 24px rgba(66, 184, 131, 0.28);
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.counter:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(66, 184, 131, 0.34);
}

.counter:active {
  transform: translateY(0);
}
</style>
`;
}

export function generateVueTemplate(data: InitData): void {
	const root = join(process.cwd(), data.projectName);
	const ext = data.variant;
	writeTemplateFiles(root, {
		'package.json': packageJsonTemplate(data),
		[`vite.config.${ext}`]: viteConfigTemplate(data),
		[`injections/manifest.${ext}`]: manifestTemplate(),
		'injections/hello-world/app.vue': vueComponentTemplate(data)
	});
	writeGitignoreFile(root);
	copyTemplateAssets(root, [
		{ source: 'vue.svg', target: 'assets/vue.svg' },
		{ source: 'makoo-icon-transparent.png', target: 'assets/makoo-icon-transparent.png' }
	]);

	if (data.variant === 'ts') {
		createTypeScriptConfigFiles(root, {
			appInclude: ['env.d.ts', 'injections/**/*.ts', 'injections/**/*.vue'],
			nodeInclude: ['vite.config.ts']
		});
	}
}
