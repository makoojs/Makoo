import { createServer } from 'vite';
import { loadCliVersion } from './_util';

const ansi = {
	reset: '\x1B[0m',
	bold: '\x1B[1m',
	cyan: '\x1B[36m',
	green: '\x1B[32m',
	dim: '\x1B[2m'
} as const;

const colorize = (value: string, ...codes: string[]): string =>
	`${codes.join('')}${value}${ansi.reset}`;

const cliVersionCache: string | null = null;

async function printDevBanner(server: Awaited<ReturnType<typeof createServer>>): Promise<void> {
	const cliVersion = await loadCliVersion(cliVersionCache);
	const title = `Makoo v${cliVersion}`;
	const urls = server.resolvedUrls;
	const localUrl = urls?.local[0];
	const networkUrl = urls?.network[0];

	console.log(`\n${colorize(title, ansi.bold, ansi.cyan)}\n`);
	console.log(
		`  ${colorize('➜', ansi.green)}  ${colorize('Local:', ansi.bold)}   ${localUrl ?? 'unavailable'}`
	);
	console.log(
		`  ${colorize('➜', ansi.green)}  ${colorize('Network:', ansi.bold)} ${networkUrl ?? colorize('use --host to expose', ansi.dim)}`
	);
}

export async function devCommand(): Promise<void> {
	const server = await createServer();
	await server.listen();
	await printDevBanner(server);
	server.bindCLIShortcuts({ print: true });
}
