export type MakooIssue = {
	path: string;
	message: string;
};

function collectCauseChain(cause?: Error): string[] {
	const lines: string[] = [];
	let current = cause;
	while (current) {
		lines.push(`  cause: ${current.message}`);
		current = current.cause as Error | undefined;
	}
	return lines;
}

export class MakooError extends Error {
	readonly code: string;
	readonly issues: MakooIssue[];
	override readonly cause?: Error;

	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		const parts: string[] = [`[makoo] ${message}`];
		if (issues?.length) {
			for (const i of issues) {
				parts.push(`  - ${i.path}: ${i.message}`);
			}
		}
		for (const line of collectCauseChain(cause)) {
			parts.push(line);
		}
		super(parts.join('\n'));
		this.name = 'MakooError';
		this.code = code ?? '';
		this.issues = issues ?? [];
		if (cause) this.cause = cause;
	}
}
