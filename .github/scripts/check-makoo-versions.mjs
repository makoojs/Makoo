import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageToVersionKey = {
	'@makoojs/core': 'core',
	'@makoojs/cli': 'cli',
	'@makoojs/vue': 'vue',
	'@makoojs/react': 'react',
	'@makoojs/create-makoo': 'create-makoo'
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../..');
const makooVersionPath = resolve(
	rootDir,
	'packages/create-makoo/src/template/makooVersion.ts'
);

export function buildExpectedVersions(releases) {
	const expectedVersions = {};

	for (const release of releases) {
		const key = packageToVersionKey[release.name];

		if (key) {
			expectedVersions[key] = `^${release.newVersion}`;
		}
	}

	return expectedVersions;
}

export function parseRecommendedVersions(source) {
	const versions = {};
	const entryPattern = /(?:['"]?([\w-]+)['"]?)\s*:\s*['"]([^'"]+)['"]/g;

	for (const match of source.matchAll(entryPattern)) {
		versions[match[1]] = match[2];
	}

	return versions;
}

export function compareRecommendedVersions(currentVersions, expectedVersions) {
	return Object.entries(expectedVersions)
		.filter(([key, expected]) => currentVersions[key] !== expected)
		.map(([key, expected]) => ({
			key,
			current: currentVersions[key] ?? '<missing>',
			expected
		}));
}

function parseArgs(argv) {
	const args = {
		since: 'origin/main'
	};

	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === '--since') {
			args.since = argv[index + 1];
			index += 1;
		}
	}

	return args;
}

function getChangesetBinary() {
	const binaryName = process.platform === 'win32' ? 'changeset.cmd' : 'changeset';
	const localBinary = resolve(rootDir, 'node_modules/.bin', binaryName);

	return existsSync(localBinary) ? localBinary : 'changeset';
}

function readPendingChangesets(since) {
	const outputDir = mkdtempSync(resolve(tmpdir(), 'makoo-changeset-status-'));
	const outputPath = resolve(outputDir, 'status.json');

	try {
		execFileSync(getChangesetBinary(), ['status', '--since', since, '--output', outputPath], {
			cwd: rootDir,
			stdio: 'pipe'
		});

		return JSON.parse(readFileSync(outputPath, 'utf8'));
	} catch (error) {
		const output = [error.stdout, error.stderr]
			.filter(Boolean)
			.map((buffer) => buffer.toString())
			.join('\n');

		if (output.includes('no changesets were found')) {
			return { releases: [] };
		}

		throw error;
	} finally {
		rmSync(outputDir, { recursive: true, force: true });
	}
}

function formatMismatchMessage(mismatches) {
	const lines = [
		'makooVersion.ts is out of sync with pending Changesets releases.',
		'',
		'Update packages/create-makoo/src/template/makooVersion.ts before merging.',
		'',
		'Mismatched entries:'
	];

	for (const mismatch of mismatches) {
		lines.push(`  ${mismatch.key}: current ${mismatch.current}, expected ${mismatch.expected}`);
	}

	return lines.join('\n');
}

function main() {
	const { since } = parseArgs(process.argv.slice(2));
	const status = readPendingChangesets(since);
	const expectedVersions = buildExpectedVersions(status.releases ?? []);

	if (Object.keys(expectedVersions).length === 0) {
		console.log('No pending Makoo package releases found. Skipping makooVersion check.');
		return;
	}

	const currentVersions = parseRecommendedVersions(readFileSync(makooVersionPath, 'utf8'));
	const mismatches = compareRecommendedVersions(currentVersions, expectedVersions);

	if (mismatches.length > 0) {
		console.error(formatMismatchMessage(mismatches));
		process.exit(1);
	}

	console.log('makooVersion.ts matches pending Changesets releases.');
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
	main();
}
