import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { JSONReport } from '@playwright/test/reporter';
import { expect, it } from 'vitest';
import {
	acceptanceCases,
	baselineInventory,
	verifyAcceptanceReport
} from '../e2e/acceptanceReport';

const failure = acceptanceCases.find((check) => check.name === 'wrong-count');
if (!failure) throw new Error('Missing wrong-count acceptance case');

function reportFor(status = 'failed', stage = 'behavior') {
	const result = {
		status,
		retry: 0,
		error: {
			message:
				"acceptance:counter-increment\nLocator: locator('#count')\nExpected: 999, received: 1"
		},
		errors: [{ message: 'assertion failed' }],
		errorLocation: { file: '/project/counter.spec.ts', line: 30, column: 1 },
		attachments: [
			['run.log', `Last stage: ${stage}\n`],
			['cleanup.json', '{"serverClosed":true,"temporaryRemoved":true}'],
			['environment.json', '{"manager":"violentmonkey"}']
		].map(([name, body]) => ({
			name,
			contentType: 'text/plain',
			body: Buffer.from(body).toString('base64')
		}))
	};
	const test = { expectedStatus: 'passed', results: [result] };
	const report = {
		errors: [],
		suites: [{ specs: [], suites: [{ specs: [{ tests: [test] }] }] }]
	};
	return { result, test, report: report as unknown as JSONReport };
}

it('only accepts the intended fault with cleanup evidence', () => {
	const { report } = reportFor();
	expect(() => verifyAcceptanceReport(report, 1, failure)).not.toThrow();
	expect(() => verifyAcceptanceReport(report, 0, failure)).toThrow('exit code');
	for (const stage of ['artifact', 'manager preparation', 'browser', 'install']) {
		expect(() => verifyAcceptanceReport(reportFor('failed', stage).report, 1, failure)).toThrow(
			'unexpected Last stage'
		);
	}
	for (const status of ['skipped', 'timedOut', 'interrupted', 'passed']) {
		expect(() => verifyAcceptanceReport(reportFor(status).report, 1, failure)).toThrow(
			'expected exactly one'
		);
	}
	const unrelated = reportFor();
	unrelated.result.error.message = 'Browser crashed';
	expect(() => verifyAcceptanceReport(unrelated.report, 1, failure)).toThrow('unrelated');
	const cleanupFailure = reportFor();
	cleanupFailure.result.errors.push({ message: 'teardown failed' });
	expect(() => verifyAcceptanceReport(cleanupFailure.report, 1, failure)).toThrow('exactly one');
	const skipped = reportFor();
	skipped.test.expectedStatus = 'failed';
	expect(() => verifyAcceptanceReport(skipped.report, 1, failure)).toThrow('expected failure');
	const retried = reportFor();
	retried.test.results.push(retried.result);
	expect(() => verifyAcceptanceReport(retried.report, 1, failure)).toThrow('retry');
	const noCleanup = reportFor();
	noCleanup.result.attachments = [];
	expect(() => verifyAcceptanceReport(noCleanup.report, 1, failure)).toThrow('cleanup.json');
});

it('rejects incomplete baselines and global runner errors', () => {
	const baseline = { ...acceptanceCases[0], count: 1, inventory: undefined };
	const { report, result } = reportFor('passed');
	result.errors = [];
	Reflect.deleteProperty(result, 'error');
	expect(() => verifyAcceptanceReport(report, 0, baseline)).not.toThrow();
	expect(() => verifyAcceptanceReport(report, 0, acceptanceCases[0])).toThrow(
		'expected 16 tests'
	);
	report.errors.push({ message: 'worker crashed' });
	expect(() => verifyAcceptanceReport(report, 0, baseline)).toThrow('global errors');
});

it('requires the exact eight baseline scenarios with two runs each', () => {
	const { result } = reportFor('passed');
	result.errors = [];
	Reflect.deleteProperty(result, 'error');
	const test = { expectedStatus: 'passed', results: [result] };
	const suites = baselineInventory.map((identity) => {
		const titles = identity.split(' / ');
		const title = titles.pop();
		let suite: object = { title: titles.pop(), specs: [{ title, tests: [test, test] }] };
		for (const parent of titles.reverse())
			suite = { title: parent, specs: [], suites: [suite] };
		return suite;
	});
	const report = {
		config: { projects: [{ repeatEach: 2 }] },
		errors: [],
		suites
	} as unknown as JSONReport;
	expect(() => verifyAcceptanceReport(report, 0, acceptanceCases[0])).not.toThrow();
	report.suites[0] = report.suites[1];
	expect(() => verifyAcceptanceReport(report, 0, acceptanceCases[0])).toThrow('inventory');
});

it('does not mistake a failed matching positive control for an excluded-page fault', () => {
	const check = acceptanceCases.find((item) => item.name === 'removed-exclude');
	if (!check) throw new Error('Missing exclude case');
	const { report, result } = reportFor();
	result.errorLocation.file = '/project/behavior.spec.ts';
	result.error.message = "Locator: locator('#script-runs')\nExpected: 1, received: 0";
	expect(() => verifyAcceptanceReport(report, 1, check)).toThrow('unrelated');
	result.error.message =
		"acceptance:excluded-page\nLocator: locator('#script-runs')\nExpected: 0, received: 1";
	expect(() => verifyAcceptanceReport(report, 1, check)).not.toThrow();
});

it('checks a real Playwright JSON report for missing-artifact failure', async () => {
	const directory = await mkdtemp(resolve(import.meta.dirname, 'acceptance-report-'));
	const reportPath = resolve(directory, 'report.json');
	const require = createRequire(resolve(import.meta.dirname, '../../../test/package.json'));
	const cli = resolve(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
	const entry = resolve(import.meta.dirname, '../../../test/dist/playwright.js');
	try {
		await writeFile(
			resolve(directory, 'playwright.config.mjs'),
			`export default { testDir: '.', workers: 1, retries: 0, reporter: 'json', outputDir: './results' };`
		);
		await writeFile(
			resolve(directory, 'missing.spec.mjs'),
			`
import { test } from ${JSON.stringify(entry)};
test.use({ userscript: ${JSON.stringify(resolve(directory, 'missing.user.js'))} });
test('missing artifact', async ({ userscriptPage }) => { await userscriptPage.goto('/'); });
`
		);
		const exitCode = await promisify(execFile)(
			process.execPath,
			[cli, 'test', '--config', resolve(directory, 'playwright.config.mjs')],
			{
				cwd: directory,
				timeout: 20_000,
				env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath }
			}
		).then(
			() => 0,
			(error) => error.code
		);
		const report = JSON.parse(await readFile(reportPath, 'utf8'));
		const check = acceptanceCases.find((item) => item.name === 'missing-artifact');
		if (!check) throw new Error('Missing artifact case');
		expect(() => verifyAcceptanceReport(report, exitCode, check)).not.toThrow();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}, 30_000);
