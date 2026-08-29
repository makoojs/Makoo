import { ErrorCode } from './ErrorCode';

export type MakooIssue = {
	path: string;
	message: string;
};

export type MakooErrorContextValue = string | number | boolean | null;
export type MakooErrorContext = Record<string, MakooErrorContextValue>;

export class MakooError extends Error {
	readonly code: string;
	readonly issues: MakooIssue[];
	readonly summary: string;
	readonly context: MakooErrorContext = {};
	override readonly cause?: Error;

	constructor(
		message: string,
		issues?: MakooIssue[],
		code: string = ErrorCode.UNKNOWN,
		cause?: Error
	) {
		const parts: string[] = [`[makoo] ${message}`];
		if (issues?.length) {
			for (const i of issues) {
				parts.push(`  - ${i.path}: ${i.message}`);
			}
		}
		super(parts.join('\n'));
		this.name = 'MakooError';
		this.code = code;
		this.issues = issues ?? [];
		this.summary = message;
		if (cause) this.cause = cause;
	}

	withContext(context: MakooErrorContext): this {
		Object.assign(this.context, context);
		return this;
	}
}
