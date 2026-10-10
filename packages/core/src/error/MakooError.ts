import type { ZodError } from 'zod';
import { MakooErrorCode } from './ErrorCode';

type MakooErrorOptions = {
	readonly code: string;
	readonly cause?: unknown;
};

export class MakooError extends Error {
	readonly code: string;

	constructor(message: string, options: MakooErrorOptions) {
		super(message);
		this.name = 'MakooError';
		this.code = options.code;
		if (options.cause !== undefined) this.cause = options.cause;
	}
}

export class MakooAggregateError extends MakooError {
	readonly errors: readonly unknown[];

	constructor(errors: readonly unknown[], message: string, options: MakooErrorOptions) {
		super(aggregateMessage(message, errors), options);
		this.name = 'MakooAggregateError';
		this.errors = errors;
	}
}

export function declaredName(input: unknown): string | undefined {
	if (typeof input !== 'object' || input === null || !('name' in input)) return undefined;
	const { name } = input;
	return typeof name === 'string' && name.trim().length > 0 ? name : undefined;
}

export function validationError(summary: string, code: string, error: ZodError): MakooError {
	const lines = error.issues.map((issue) => {
		const path = issue.path.map(String).join('.');
		return `${path || '(root)'}: ${issue.message}`;
	});
	return new MakooError([summary, ...lines].join('\n'), { code, cause: error });
}

export function stateSubscriberFailed(owner: string, cause: unknown): MakooError {
	return new MakooError(`State subscriber of ${owner} failed`, {
		code: MakooErrorCode.STATE_SUBSCRIBER_FAILED,
		cause
	});
}

export function injectionCleanupFailed(
	name: string,
	errors: readonly unknown[]
): MakooAggregateError {
	return new MakooAggregateError(errors, `Cleanup failed for "${name}"`, {
		code: MakooErrorCode.INJECTION_CLEANUP_FAILED
	});
}

function aggregateMessage(message: string, errors: readonly unknown[]): string {
	// A child may itself list further errors. The parent keeps one line per direct child.
	const lines = errors.map((error) => {
		const text = error instanceof Error ? error.message : String(error);
		const newline = text.indexOf('\n');
		return newline === -1 ? text : text.slice(0, newline);
	});
	return [message, ...lines].join('\n');
}
