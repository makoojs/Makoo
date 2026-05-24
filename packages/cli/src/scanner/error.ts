import { relative } from 'node:path';
import process from 'node:process';
import { RiteError, type RiteIssue } from '@rite/core';
import type { z } from 'zod';

export type { RiteIssue };
export { RiteError };

// --- Manifest validation error (CLI-specific) ---

export class ManifestValidationError extends RiteError {
	constructor(file: string, zodIssues: z.ZodIssue[], code?: string) {
		const issues = zodIssues.map(toRiteIssue);
		const rel = relative(process.cwd(), file);
		super(`Invalid manifest at ${rel}`, issues, code);
		this.name = 'ManifestValidationError';
	}
}

// --- Zod issue → RiteIssue translation ---

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

export function toRiteIssue(issue: z.ZodIssue): RiteIssue {
	return {
		path: formatZodPath(issue.path),
		message: formatZodMessage(issue)
	};
}
