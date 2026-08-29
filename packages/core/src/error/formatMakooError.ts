import type { MakooError, MakooErrorContextValue } from './MakooError';

const formatContextValue = (value: MakooErrorContextValue): string =>
	// vue => "vue"
	// Make the context more explicit and handle special characters
	typeof value === 'string' ? JSON.stringify(value) : String(value);

const indent = (value: string): string =>
	value
		.split('\n')
		.map((line) => `  ${line}`)
		.join('\n');

export function formatMakooError(error: MakooError): string {
	const lines = [`${error.name} [${error.code}]:`, error.summary];

	if (error.issues.length > 0) {
		// zod output format
		for (const issue of error.issues) {
			lines.push(`  - ${issue.path}: ${issue.message}`);
		}
	}

	const context = Object.entries(error.context);
	if (context.length > 0) {
		lines.push(
			`(${context.map(([key, value]) => `${key}: ${formatContextValue(value)}`).join(', ')})`
		);
	}

	if (error.cause?.stack) {
		lines.push('', indent(error.cause.stack));
	}

	return lines.join('\n');
}
