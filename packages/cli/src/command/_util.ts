import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { DEFAULT_SOURCE_DIR } from '../config/defaults';
import { UnsupportedFrameworkGenerationError } from '../error/error';

export function getExtName(framework: string): string | null {
	const lowerFramework = framework.toLowerCase();
	if (lowerFramework === 'vue') {
		return '.vue';
	}
	if (lowerFramework === 'react') {
		if (existsSync(join(process.cwd(), 'tsconfig.json'))) {
			return '.tsx';
		}
		return '.jsx';
	}
	return null;
}

export async function updateManifest(
	moduleName: string,
	updateData: Record<string, unknown>
): Promise<void> {
	const sourcePath = join(process.cwd(), DEFAULT_SOURCE_DIR);
	const sourceFiles = await readdir(sourcePath);
	let manifestName: string | null = null;
	for (const file of sourceFiles) {
		if ('manifest' === file.split('.')[0]) {
			manifestName = file;
			break;
		}
	}
	const merged: Record<string, unknown> = { injections: { [moduleName]: updateData } };
	// when manifest does not exist, create a new one
	if (!manifestName) {
		const newManifestPath = join(sourcePath, 'manifest.ts');
		await writeFile(
			newManifestPath,
			`import { defineInjections } from "@makoo/cli";\nexport default defineInjections(${JSON.stringify(merged, null, 2)})\n`,
			'utf-8'
		);
		return;
	}

	const manifestPath = join(sourcePath, manifestName);
	const manifestContent = await readFile(manifestPath, 'utf-8');

	const jiti = createJiti(sourcePath, { moduleCache: false });
	const existing = (await jiti.import(manifestPath, { default: true })) as Record<
		string,
		unknown
	>;
	const injections = existing.injections;

	let updatedInjections: unknown[] | Record<string, unknown>;
	if (Array.isArray(injections)) {
		updatedInjections = [...injections, { name: moduleName, ...updateData }];
	} else if (injections && typeof injections === 'object') {
		updatedInjections = {
			...(injections as Record<string, unknown>),
			[moduleName]: updateData
		};
	} else {
		updatedInjections = { [moduleName]: updateData };
	}

	Object.assign(merged, { ...existing, injections: updatedInjections });

	const updated = manifestContent.replace(
		/defineInjections\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/,
		`defineInjections(${JSON.stringify(merged, null, 2)})`
	);

	await writeFile(manifestPath, updated, 'utf-8');
}

export function moduleTemplate(framework: string): string {
	switch (framework) {
		case 'Vue':
			return vueTemplate();
		case 'React':
			return reactTemplate();
		default:
			throw new UnsupportedFrameworkGenerationError(framework);
	}
}
export function vueTemplate(): string {
	return `<template>
  <div>hello-Vue !!</div>
</template>
`;
}

export function reactTemplate(): string {
	return `export default function App() {
  return <div>hello-React !!</div>;
}
`;
}
