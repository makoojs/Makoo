import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';

export type AcceptanceCase = {
	name: string;
	args: string[];
	env: Record<string, string>;
	count: number;
	inventory?: readonly string[];
	failure?: { stage: string; message: string; file?: string };
};

export const baselineInventory = [
	'behavior.spec.ts / alive / remounts after host replacement and releases detached listeners',
	'behavior.spec.ts / matching / runs on matching pages and respects exclude and nonmatching paths',
	'behavior.spec.ts / storage / persists across reloads in first isolated profile',
	'behavior.spec.ts / storage / persists across reloads in second isolated profile',
	'consumer.spec.ts / installed core tarball produces a working userscript',
	'counter.spec.ts / compiled userscript counts clicks and cleans up listeners',
	'frameworks.spec.ts / vue / compiled framework updates state after clicks',
	'frameworks.spec.ts / react / compiled framework updates state after clicks'
];

export const acceptanceCases: AcceptanceCase[] = [
	{
		name: 'baseline',
		args: ['--repeat-each=2', '--max-failures=1'],
		env: {},
		count: 16,
		inventory: baselineInventory
	},
	{
		name: 'missing-artifact',
		args: ['counter.spec.ts'],
		env: { MAKOO_E2E_FAULT: 'install' },
		count: 1,
		failure: { stage: 'artifact', message: 'ENOENT' }
	},
	{
		name: 'wrong-match',
		args: ['counter.spec.ts'],
		env: { MAKOO_E2E_FAULT: 'match' },
		count: 1,
		failure: {
			stage: 'behavior',
			message: 'acceptance:counter-started',
			file: 'counter.spec.ts'
		}
	},
	{
		name: 'wrong-count',
		args: ['counter.spec.ts'],
		env: { MAKOO_E2E_FAULT: 'count' },
		count: 1,
		failure: {
			stage: 'behavior',
			message: 'acceptance:counter-increment',
			file: 'counter.spec.ts'
		}
	},
	{
		name: 'disabled-alive',
		args: ['behavior.spec.ts', '--grep', 'alive'],
		env: { MAKOO_BEHAVIOR_FAULT: 'disable-alive' },
		count: 1,
		failure: {
			stage: 'behavior',
			message: 'acceptance:alive-restored',
			file: 'behavior.spec.ts'
		}
	},
	{
		name: 'removed-exclude',
		args: ['behavior.spec.ts', '--grep', 'matching'],
		env: { MAKOO_BEHAVIOR_FAULT: 'remove-exclude' },
		count: 1,
		failure: {
			stage: 'behavior',
			message: 'acceptance:excluded-page',
			file: 'behavior.spec.ts'
		}
	},
	{
		name: 'lost-storage',
		args: ['behavior.spec.ts', '--grep', 'storage'],
		env: { MAKOO_BEHAVIOR_FAULT: 'skip-storage-write' },
		count: 2,
		failure: {
			stage: 'behavior',
			message: 'acceptance:storage-restored',
			file: 'behavior.spec.ts'
		}
	}
];

function specsIn(
	suites: JSONReportSuite[],
	parents: string[] = []
): {
	identity: string;
	tests: JSONReportSuite['specs'][number]['tests'];
}[] {
	return suites.flatMap((suite) => [
		...suite.specs.map((spec) => ({
			identity: [...parents, suite.title, spec.title].join(' / '),
			tests: spec.tests
		})),
		...specsIn(suite.suites ?? [], [...parents, suite.title])
	]);
}

/** Validate Playwright's report; a nonzero exit alone is never a successful fault check. */
export function verifyAcceptanceReport(
	report: JSONReport,
	exitCode: number | null,
	check: AcceptanceCase
) {
	const reject = (reason: string): never => {
		throw new Error(`${check.name}: ${reason}`);
	};
	if (exitCode !== (check.failure ? 1 : 0)) reject(`unexpected exit code ${exitCode}`);
	if (report.errors.length) reject('runner/global errors');
	const specs = specsIn(report.suites);
	const tests = specs.flatMap((spec) => spec.tests);
	if (tests.length !== check.count)
		reject(`expected ${check.count} tests, found ${tests.length}`);
	if (check.inventory) {
		if (report.config.projects.length !== 1 || report.config.projects[0].repeatEach !== 2) {
			reject('baseline must use one project with repeatEach=2');
		}
		const found = new Set(specs.map((spec) => spec.identity));
		if (
			found.size !== check.inventory.length ||
			specs.length !== found.size ||
			check.inventory.some((identity) => !found.has(identity)) ||
			specs.some((spec) => spec.tests.length !== 2)
		) {
			reject('baseline scenario inventory or repeat count differs');
		}
	}
	for (const test of tests) {
		if (test.expectedStatus !== 'passed' || test.results.length !== 1)
			reject('skip, expected failure or retry');
		const result = test.results[0];
		if (result.retry !== 0) reject('retry is not acceptance evidence');
		const body = (name: string) => {
			const attachment = result.attachments.find((item) => item.name === name);
			if (!attachment?.body) return reject(`missing ${name} attachment body`);
			return Buffer.from(attachment.body, 'base64').toString('utf8');
		};
		const cleanup = JSON.parse(body('cleanup.json'));
		if (cleanup.serverClosed !== true || cleanup.temporaryRemoved !== true)
			reject('cleanup incomplete');
		const stage = body('run.log').split('\n')[0];
		if (stage !== `Last stage: ${check.failure?.stage ?? 'behavior'}`)
			reject(`unexpected ${stage}`);
		if (!check.failure) {
			if (result.status !== 'passed' || result.errors.length || result.error)
				reject('baseline did not pass cleanly');
			body('environment.json');
		} else {
			if (result.status !== 'failed' || result.errors.length !== 1)
				reject('expected exactly one assertion/preparation failure');
			if (!result.error?.message?.includes(check.failure.message))
				reject('failure is unrelated to the injected fault');
			if (
				check.failure.file &&
				result.errorLocation?.file.replaceAll('\\', '/').split('/').at(-1) !==
					check.failure.file
			) {
				reject('failure did not originate in the expected behavior spec');
			}
		}
	}
}
