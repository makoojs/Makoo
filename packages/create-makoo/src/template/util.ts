import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recommendedMakooVersions } from './makooVersion';
import type {
	DependencyMode,
	MakooDependencyResult,
	MakooFramework,
	TemplateAsset,
	TsconfigTemplateOptions
} from './types';

const gitignoreTemplate = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`;
export const ansi = {
	reset: '\x1B[0m',
	bold: '\x1B[1m',
	cyan: '\x1B[36m',
	green: '\x1B[32m',
	dim: '\x1B[2m',
	red: '\x1B[31m',
	blue: '\x1B[34m',
	yellow: '\x1B[33m'
} as const;
export const colorize = (value: string, ...codes: string[]): string => {
	return `${codes.join('')}${value}${ansi.reset}`;
};

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function toJson(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function resolveAssetRoot(): string {
	const currentDir = dirname(fileURLToPath(import.meta.url));
	const candidateDirs = [join(currentDir, '../assets'), join(currentDir, '../../assets')];

	for (const candidateDir of candidateDirs) {
		if (existsSync(candidateDir)) {
			return candidateDir;
		}
	}

	throw new Error('[makoo] Template assets directory not found.');
}

// DEBUG Code
// This code will be deleted when those packages are published.
function resolveRepoRoot(): string {
	const currentDir = dirname(fileURLToPath(import.meta.url));
	const candidateDirs = [join(currentDir, '../../../..'), join(currentDir, '../../..')];

	for (const candidateDir of candidateDirs) {
		if (
			existsSync(join(candidateDir, 'package.json')) &&
			existsSync(join(candidateDir, 'packages'))
		) {
			return candidateDir;
		}
	}

	throw new Error('[makoo] Repository root not found.');
}

function resolveLocalPackagePath(packageName: string): string {
	return join(resolveRepoRoot(), 'packages', packageName).replace(/\\/g, '/');
}

export function writeTemplateFiles(root: string, files: Record<string, string>): void {
	ensureDir(root);

	for (const [file, content] of Object.entries(files)) {
		const filePath = join(root, file);
		ensureDir(dirname(filePath));
		writeFileSync(filePath, content, 'utf-8');
	}
}

export function copyTemplateAssets(root: string, assets: TemplateAsset[]): void {
	const assetRoot = resolveAssetRoot();
	ensureDir(root);

	for (const asset of assets) {
		const sourcePath = join(assetRoot, asset.source);
		const targetPath = join(root, asset.target);
		ensureDir(dirname(targetPath));
		copyFileSync(sourcePath, targetPath);
	}
}

export function writeGitignoreFile(root: string): void {
	writeTemplateFiles(root, {
		'.gitignore': gitignoreTemplate
	});
}

export function resolveDependencyMode(debug = process.env.MAKOO_DEBUG_LOCAL_DEPS): DependencyMode {
	return debug === '1' || debug === 'true' ? 'local' : 'npm';
}

export function resolveMakooDependencies(
	framework: MakooFramework,
	mode: DependencyMode
): MakooDependencyResult {
	const packagePath = (name: string): string =>
		mode === 'local'
			? resolveLocalPackagePath(name)
			: recommendedMakooVersions[name as keyof typeof recommendedMakooVersions];

	return {
		dependencies: {
			'@makoojs/core': packagePath('core'),
			[`@makoojs/${framework.toLowerCase()}`]: packagePath(framework.toLowerCase())
		},
		devDependencies: {
			'@makoojs/cli': packagePath('cli')
		}
	};
}

export function createTypeScriptConfigFiles(root: string, options: TsconfigTemplateOptions): void {
	const appTypes = options.appTypes ?? ['vite/client'];

	writeTemplateFiles(root, {
		'tsconfig.json': toJson({
			files: [],
			references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }]
		}),
		'tsconfig.app.json': toJson({
			compilerOptions: {
				tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
				target: 'ES2023',
				useDefineForClassFields: true,
				module: 'ESNext',
				lib: ['ES2023', 'DOM', 'DOM.Iterable'],
				types: appTypes,
				skipLibCheck: true,
				moduleResolution: 'bundler',
				allowImportingTsExtensions: true,
				isolatedModules: true,
				moduleDetection: 'force',
				noEmit: true,
				strict: true,
				noUnusedLocals: true,
				noUnusedParameters: true,
				noFallthroughCasesInSwitch: true,
				noUncheckedSideEffectImports: true,
				forceConsistentCasingInFileNames: true,
				...options.appCompilerOptions
			},
			include: options.appInclude
		}),
		'tsconfig.node.json': toJson({
			compilerOptions: {
				tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
				target: 'ES2023',
				lib: ['ES2023'],
				types: ['node'],
				module: 'ESNext',
				skipLibCheck: true,
				moduleResolution: 'bundler',
				allowImportingTsExtensions: true,
				isolatedModules: true,
				moduleDetection: 'force',
				noEmit: true,
				strict: true,
				noUnusedLocals: true,
				noUnusedParameters: true,
				noFallthroughCasesInSwitch: true,
				noUncheckedSideEffectImports: true
			},
			include: options.nodeInclude
		}),
		'env.d.ts': '/// <reference types="vite/client" />\n'
	});
}
