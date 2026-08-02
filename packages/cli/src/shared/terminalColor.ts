export const ansi = {
	reset: '\x1B[0m',
	bold: '\x1B[1m',
	cyan: '\x1B[36m',
	deepPink: '\x1B[38;5;162m',
	green: '\x1B[32m',
	dim: '\x1B[2m'
} as const;

export const colorize = (value: string, ...codes: string[]): string =>
	`${codes.join('')}${value}${ansi.reset}`;
