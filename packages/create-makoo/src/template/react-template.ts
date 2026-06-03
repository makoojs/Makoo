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
		vite: '^8.0.14',
		'@vitejs/plugin-react': '^5.2.0'
	};

	if (data.variant === 'ts') {
		devDeps.typescript = '~5.9.3';
		devDeps['@types/node'] = '^25.9.1';
		devDeps['@types/react'] = '^19.2.15';
		devDeps['@types/react-dom'] = '^19.2.3';
	}

	const deps = {
		react: '^19.2.0',
		'react-dom': '^19.2.0'
	};
	const makooDependencies = resolveMakooDependencies(data.framework, data.dependencyMode);

	const obj = {
		name: data.projectName,
		version: data.version,
		type: 'module',
		scripts: {
			dev: 'makoo dev',
			build: data.variant === 'ts' ? 'tsc -b && makoo build' : 'makoo build',
			...(data.variant === 'ts' ? { typecheck: 'tsc -b' } : {})
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
    dedupe: ['react', 'react-dom']
  },
`
			: '';

	return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { makoo } from '@makoo/cli';

export default defineConfig({
  ${localResolveBlock}plugins: [
    react(),
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
        // Uses the third-party umd-react package because React 19 and related
        // react-dom packages no longer ship official UMD builds. That package
        // squishes ReactDOM and ReactDOMClient back into the same ReactDOM
        // global for backward compatibility, so react-dom/client also resolves
        // to the ReactDOM UMD build here. If you want to use React, prefer
        // React 18 or a third-party UMD package.
        build: {
          externalGlobals: {
          react: [
            'React',
            () => 'https://unpkg.com/umd-react/dist/react.production.min.js'
          ],
          'react-dom': [
            'ReactDOM',
            () => 'https://unpkg.com/umd-react/dist/react-dom.production.min.js'
          ],
          'react-dom/client': [
            'ReactDOM',
            () => 'https://unpkg.com/umd-react/dist/react-dom.production.min.js'
          ]
          }
        },
      },
    }),
  ],
});
`;
}

function manifestTemplate(data: InitData): string {
	return `import { defineInjections } from '@makoo/cli';

export default defineInjections({
  injections: {
    'hello-world': {
      injectAt: 'body',
      component: './hello-world/app.${data.variant === 'ts' ? 'tsx' : 'jsx'}',
    }
  }
});
`;
}

function reactComponentTemplate(data: InitData): string {
	const stateImport =
		data.variant === 'ts'
			? "import { useState } from 'react';"
			: "import { useState } from 'react';";

	return `${stateImport}
import './style.css';
import makooLogo from '../../assets/makoo-icon-transparent.png';
import reactLogo from '../../assets/react.svg';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <section className="makoo-hello-world">
      <div className="hero">
        <img src={reactLogo} className="logo logo-react" alt="React logo" />
        <span className="hero-plus">+</span>
        <img src={makooLogo} className="logo logo-makoo" alt="Makoo logo" />
      </div>

      <div className="content">
        <h1>Makoo</h1>
        <p>
          Edit <code>app.${data.variant === 'ts' ? 'tsx' : 'jsx'}</code> and save to test HMR.
        </p>
      </div>

      <button type="button" className="counter" onClick={() => setCount((value) => value + 1)}>
        count is {count}
      </button>
    </section>
  );
}
`;
}

function reactStyleTemplate(): string {
	return `.makoo-hello-world {
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

.logo-react {
  width: 88px;
  height: 88px;
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
  background: linear-gradient(135deg, #61dafb, #2563eb);
  color: #fff;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
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
  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.28);
}

.counter:active {
  transform: translateY(0);
}
`;
}

export function generateReactTemplate(data: InitData): void {
	const root = join(process.cwd(), data.projectName);
	const ext = data.variant;
	const componentExt = data.variant === 'ts' ? 'tsx' : 'jsx';

	writeTemplateFiles(root, {
		'package.json': packageJsonTemplate(data),
		[`vite.config.${ext}`]: viteConfigTemplate(data),
		[`injections/manifest.${ext}`]: manifestTemplate(data),
		[`injections/hello-world/app.${componentExt}`]: reactComponentTemplate(data),
		'injections/hello-world/style.css': reactStyleTemplate()
	});
	writeGitignoreFile(root);
	copyTemplateAssets(root, [
		{ source: 'react.svg', target: 'assets/react.svg' },
		{ source: 'makoo-icon-transparent.png', target: 'assets/makoo-icon-transparent.png' }
	]);

	if (data.variant === 'ts') {
		createTypeScriptConfigFiles(root, {
			appInclude: ['env.d.ts', 'injections/**/*.ts', 'injections/**/*.tsx'],
			nodeInclude: ['vite.config.ts'],
			appCompilerOptions: {
				jsx: 'react-jsx'
			}
		});
	}
}
