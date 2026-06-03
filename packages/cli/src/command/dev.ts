import { createServer } from 'vite';
import { ansi, colorize, loadCliVersion } from './_util';

const cliVersionCache: string | null = null;

async function printDevBanner(server: Awaited<ReturnType<typeof createServer>>): Promise<void> {
	const cliVersion = await loadCliVersion(cliVersionCache);
	const title = `Makoo v${cliVersion}`;
	const urls = server.resolvedUrls;
	const localUrl = urls?.local[0];
	const networkUrl = urls?.network[0];

	console.log(`\n${colorize(title, ansi.bold, ansi.cyan)}\n`);
	console.log(
		`  ${colorize('➜', ansi.green)}  ${colorize('Local:', ansi.bold)}   ${colorize(localUrl ?? 'unavailable', ansi.cyan)}`
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
