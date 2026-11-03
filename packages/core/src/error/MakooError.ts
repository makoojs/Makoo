import { MakooErrorCode } from './ErrorCode';

/** How a Makoo error reaches the user: thrown, written to state, or reported as a diagnostic. */
export type ErrorCategory = 'configuration' | 'control' | 'execution' | 'cleanup' | 'callback';

type MakooErrorOptions = {
	readonly code: string;
	readonly category?: ErrorCategory;
	readonly cause?: unknown;
	readonly details?: unknown;
	readonly errors?: readonly unknown[];
};

const makooErrorMark = Symbol.for('makoo.error');

/** The error type Core throws and reports; match on `code`, not on `message`. */
export class MakooError extends Error {
	/** The delivery channel this error belongs to; set when created through an error table. */
	readonly category?: ErrorCategory;
	/** Identifies the problem: a code from the owning package's error table. */
	readonly code: string;
	/** Structured, serializable context for the code; set when created through an error table. */
	readonly details?: unknown;
	/** Collected failures for aggregate codes, in the order they happened. */
	readonly errors?: readonly unknown[];

	constructor(message: string, options: MakooErrorOptions) {
		super(message);
		this.name = 'MakooError';
		this.code = options.code;
		if (options.category !== undefined) this.category = options.category;
		if (options.cause !== undefined) this.cause = options.cause;
		if (options.details !== undefined) this.details = options.details;
		if (options.errors !== undefined) this.errors = options.errors;
		(this as Record<symbol, unknown>)[makooErrorMark] = true;
	}
}

/** Whether the value carries the Makoo error mark; reliable across bundled copies. */
export function isMakooError(value: unknown): value is MakooError {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Record<symbol, unknown>)[makooErrorMark] === true
	);
}

/** Appends one line per direct error to the headline; shared by aggregates and error tables. */
export function aggregateMessage(message: string, errors: readonly unknown[]): string {
	// A child may itself list further errors. The parent keeps one line per direct child.
	const lines = errors.map((error) => {
		const text = error instanceof Error ? error.message : String(error);
		const newline = text.indexOf('\n');
		return newline === -1 ? text : text.slice(0, newline);
	});
	return [message, ...lines].join('\n');
}

/** A {@link MakooError} that collects several failures; the message adds one line per error. */
export class MakooAggregateError extends MakooError {
	/** The collected failures, in the order they happened. */
	readonly errors: readonly unknown[];

	constructor(errors: readonly unknown[], message: string, options: MakooErrorOptions) {
		super(aggregateMessage(message, errors), options);
		this.name = 'MakooAggregateError';
		this.errors = errors;
	}
}

export function stateSubscriberFailed(owner: string, cause: unknown): MakooError {
	return new MakooError(`State subscriber of ${owner} failed`, {
		code: MakooErrorCode.STATE_SUBSCRIBER_FAILED,
		cause
	});
}

export function instanceObserverFailed(cause: unknown): MakooError {
	return new MakooError('Instance observe handler failed', {
		code: MakooErrorCode.INSTANCE_OBSERVER_FAILED,
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
