import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { CJS_IMPORT_RE, ESM_IMPORT_RE, SOURCE_EXTENSIONS } from '../config/defaults';
import type { CollectDependenciesOption } from './types';

function isInsideRoot(file: string, root: string): boolean {
	const rel = path.relative(root, file);
	return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
function isNodeModulesFile(file: string): boolean {
	return file.split(path.sep).includes('node_modules');
}
function isRelativeSpecifier(specifier: string): boolean {
	return specifier.startsWith('./') || specifier.startsWith('../');
}
function extractLocalSpecifiers(code: string): string[] {
	const specifiers: string[] = [];

	for (const match of code.matchAll(ESM_IMPORT_RE)) {
		const specifier = match[1] ?? match[2];
		if (!specifier) continue;
		if (!isRelativeSpecifier(specifier)) continue;
		specifiers.push(specifier);
	}

	for (const match of code.matchAll(CJS_IMPORT_RE)) {
		const specifier = match[1];
		if (!specifier) continue;
		if (!isRelativeSpecifier(specifier)) continue;
		specifiers.push(specifier);
	}

	return specifiers;
}
function tryFile(filePath: string): string | null {
	if (!existsSync(filePath)) return null;
	if (!statSync(filePath).isFile()) return null;
	return path.resolve(filePath);
}

function resolveLocalImport(fromDir: string, specifier: string): string | null {
	const base = path.resolve(fromDir, specifier);

	const direct = tryFile(base);
	if (direct) return direct;

	for (const ext of SOURCE_EXTENSIONS) {
		const withExt = tryFile(base + ext);
		if (withExt) return withExt;
	}

	for (const ext of SOURCE_EXTENSIONS) {
		const asIndex = tryFile(path.join(base, `index${ext}`));
		if (asIndex) return asIndex;
	}

	return null;
}

export function collectDependencies(
	entryFile: string,
	options: CollectDependenciesOption
): string[] {
	const root: string = path.resolve(options.root);
	const visited = new Set<string>();
	const result = new Set<string>();

	const walk = (file: string): void => {
		const resolveFile = path.resolve(file);
		if (visited.has(resolveFile)) return;
		visited.add(resolveFile);

		if (!isInsideRoot(resolveFile, root)) return;
		if (isNodeModulesFile(resolveFile)) return;

		if (!existsSync(resolveFile)) return;
		if (!statSync(resolveFile).isFile()) return;

		if (options.includeEntry || resolveFile !== path.resolve(entryFile))
			result.add(resolveFile);

		const code = readFileSync(resolveFile, 'utf8');
		const dir = path.dirname(resolveFile);

		for (const specifier of extractLocalSpecifiers(code)) {
			const dep = resolveLocalImport(dir, specifier);
			if (!dep) continue;
			walk(dep);
		}
	};
	walk(entryFile);
	return Array.from(result);
}
