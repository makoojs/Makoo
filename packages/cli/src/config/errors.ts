import { MakooError, type MakooIssue } from '@makoojs/core';

export const ErrorCode = {
	CLI_CONFIG_INVALID: 'MAKOO_CLI_CONFIG_INVALID'
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ValidationIssue {
	code: string;
	path: PropertyKey[];
	message: string;
}

export class ConfigValidationError extends MakooError {
	constructor(issues: MakooIssue[], code: string = ErrorCode.CLI_CONFIG_INVALID, cause?: Error) {
		super('Invalid CliConfig', issues, code, cause);
		this.name = 'ConfigValidationError';
	}
}

function formatZodPath(path: PropertyKey[]): string {
	if (path.length === 0) return '(root)';
	return path
		.filter((part) => typeof part !== 'symbol')
		.map((part) => (typeof part === 'number' ? `[${part}]` : part))
		.join('.');
}

function formatZodMessage(issue: ValidationIssue): string {
	if (issue.code === 'invalid_type' && issue.message.endsWith('received undefined')) {
		return 'is required';
	}
	return issue.message;
}

export function toMakooIssue(issue: ValidationIssue): MakooIssue {
	return {
		path: formatZodPath(issue.path),
		message: formatZodMessage(issue)
	};
}
