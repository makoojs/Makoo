import { relative } from 'node:path';
import process from 'node:process';
import type { z } from 'zod';

// --- Types ---

export type RiteIssue = {
	path: string;
	message: string;
};

// --- Error classes ---

export class RiteError extends Error {
	readonly issues: RiteIssue[];

	constructor(message: string, issues?: RiteIssue[]) {
		const formatted = issues?.length
			? `[rite] ${message}\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`
			: `[rite] ${message}`;
		super(formatted);
		this.name = 'RiteError';
		this.issues = issues ?? [];
	}
}

export class ManifestValidationError extends RiteError {
	constructor(file: string, zodIssues: z.ZodIssue[]) {
		const issues = zodIssues.map(toRiteIssue);
		const rel = relative(process.cwd(), file);
		super(`Invalid manifest at ${rel}`, issues);
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

function toRiteIssue(issue: z.ZodIssue): RiteIssue {
	return {
		path: formatZodPath(issue.path),
		message: formatZodMessage(issue)
	};
}
