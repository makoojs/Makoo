import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { acceptanceCases, verifyAcceptanceReport } from './acceptanceReport.ts';

const root = import.meta.dirname;
const require = createRequire(import.meta.url);
const cli = resolve(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const parent = resolve(root, 'acceptance-results');
await mkdir(parent, { recursive: true });
const output = await mkdtemp(resolve(parent, 'run-'));
console.log(`Playwright acceptance evidence: ${output}`);

try {
	for (const check of acceptanceCases) {
		const directory = resolve(output, check.name);
		await mkdir(directory);
		const reportPath = resolve(directory, 'report.json');
		const log = createWriteStream(resolve(directory, 'runner.log'));
		const env = { ...process.env };
		delete env.MAKOO_E2E_FAULT;
		delete env.MAKOO_BEHAVIOR_FAULT;
		console.log(`Running ${check.name}...`);
		const child = spawn(
			process.execPath,
			[
				cli,
				'test',
				'--config',
				resolve(root, 'playwright.config.ts'),
				'--reporter=json',
				'--workers=1',
				'--retries=0',
				'--output',
				resolve(directory, 'test-results'),
				...check.args
			],
			{
				cwd: root,
				env: { ...env, ...check.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath },
				stdio: ['ignore', 'pipe', 'pipe']
			}
		);
		child.stdout.pipe(log, { end: false });
		child.stderr.pipe(log, { end: false });
		let exitCode: number | null;
		try {
			exitCode = await new Promise<number | null>((accept, reject) => {
				child.once('error', reject);
				child.once('close', accept);
			});
		} finally {
			log.end();
			await finished(log);
		}
		const report = JSON.parse(await readFile(reportPath, 'utf8'));
		verifyAcceptanceReport(report, exitCode, check);
		console.log(`${check.name}: verified`);
	}
	console.log('All acceptance checks verified. See the Playwright reports above.');
} catch (error) {
	console.error(error);
	console.error(`Acceptance stopped; inspect ${output}. Later checks were not run.`);
	process.exitCode = 1;
}
