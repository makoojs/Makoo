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

function aggregateMessage(message: string, errors: readonly unknown[]): string {
	// A child may itself list further errors. The parent keeps one line per direct child.
	const lines = errors.map((error) => {
		const text = error instanceof Error ? error.message : String(error);
		const newline = text.indexOf('\n');
		return newline === -1 ? text : text.slice(0, newline);
	});
	return [message, ...lines].join('\n');
}
