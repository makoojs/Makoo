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
	declare readonly category?: ErrorCategory;
	/** Identifies the problem: a code from the owning package's error table. */
	readonly code: string;
	/** Structured, serializable context for the code; set when created through an error table. */
	declare readonly details?: unknown;
	/** Collected failures for aggregate codes, in the order they happened. */
	declare readonly errors?: readonly unknown[];

	constructor(message: string, options: MakooErrorOptions) {
		super(message);
		this.name = 'MakooError';
		this.code = options.code;
		if (options.category !== undefined) this.category = options.category;
		if (options.cause !== undefined) this.cause = options.cause;
		if (options.details !== undefined) this.details = options.details;
		if (options.errors !== undefined) this.errors = options.errors;
		Object.defineProperty(this, makooErrorMark, { value: true });
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

/** Appends one line per direct error to the headline of an aggregate error. */
export function aggregateMessage(message: string, errors: readonly unknown[]): string {
	// A child may itself list further errors. The parent keeps one line per direct child.
	const lines = errors.map((error) => {
		const text = error instanceof Error ? error.message : String(error);
		const newline = text.indexOf('\n');
		return newline === -1 ? text : text.slice(0, newline);
	});
	return [message, ...lines].join('\n');
}
