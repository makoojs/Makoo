import { relative } from 'node:path';
import process from 'node:process';
import { MakooError, type MakooIssue } from '@makoo/core';
import type { z } from 'zod';

export type { MakooIssue };
export { MakooError };

// --- Manifest validation error (CLI-specific) ---

export class ManifestValidationError extends MakooError {
	constructor(file: string, zodIssues: z.ZodIssue[], code?: string) {
		const issues = zodIssues.map(toMakooIssue);
		const rel = relative(process.cwd(), file);
		super(`Invalid manifest at ${rel}`, issues, code);
		this.name = 'ManifestValidationError';
	}
}

// --- Zod issue → MakooIssue translation ---

function formatZodPath(path: PropertyKey[]): string {
	if (path.length === 0) return '(root)';
	return path
		.filter((p) => typeof p !== 'symbol')
		.map((p) => (typeof p === 'number' ? `[${p}]` : p))
		.join('.');
}

function formatZodMessage(issue: z.ZodIssue): string {
	if (issue.code === 'invalid_type' && issue.message.endsWith('received undefined')) {
		return 'is required';
	}
	return issue.message;
}

export function toMakooIssue(issue: z.ZodIssue): MakooIssue {
	return {
		path: formatZodPath(issue.path),
		message: formatZodMessage(issue)
	};
}
