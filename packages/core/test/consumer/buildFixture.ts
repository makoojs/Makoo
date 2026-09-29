import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'vite';
import { makoo } from '../../../cli/src/vite/makoo';

const execute = promisify(execFile);

export async function buildConsumerFixture(baseURL: string, outputDir: string) {
	const root = resolve(outputDir, '../consumer');
	const tarballs = resolve(root, 'tarballs');
	await mkdir(tarballs, { recursive: true });
	const packed = await execute(
		'npm',
		['pack', '--json', '--ignore-scripts', '--pack-destination', tarballs],
		{
			cwd: resolve(import.meta.dirname, '../..'),
			timeout: 30_000
		}
	);
	const [{ filename }] = JSON.parse(packed.stdout) as { filename: string }[];
	await writeFile(
		resolve(root, 'package.json'),
		JSON.stringify({
			name: 'makoo-tarball-consumer',
			private: true,
			type: 'module',
			dependencies: { '@makoojs/core': `file:./tarballs/${filename}` }
		})
	);
	await execute('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], {
		cwd: root,
		timeout: 30_000
	});
	await copyFile(resolve(import.meta.dirname, 'main.ts'), resolve(root, 'main.ts'));
	// Resolve both published entrypoints in the isolated consumer, without source aliases.
	await execute(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
import { createRequire } from 'node:module';
import { createMakoo, listen } from '@makoojs/core';
const cjs = createRequire(import.meta.url)('@makoojs/core');
if ([createMakoo, listen, cjs.createMakoo, cjs.listen].some(value => typeof value !== 'function')) {
 throw new Error('Missing public core exports');
}
`
		],
		{ cwd: root, timeout: 10_000 }
	);
	const manifest = JSON.parse(
		await readFile(resolve(root, 'node_modules/@makoojs/core/package.json'), 'utf8')
	);
	await readFile(resolve(root, 'node_modules/@makoojs/core', manifest.types));
	await build({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: makoo({
			root,
			entry: './main.ts',
			app: { name: 'makoo-tarball-consumer', version: '0.0.1' },
			monkey: {
				userscript: { match: [`${baseURL}/*`], grant: ['none'], 'run-at': 'document-end' },
				build: { fileName: 'consumer.user.js', metaFileName: false }
			}
		}),
		build: { outDir: outputDir, emptyOutDir: true, minify: true }
	});
	return resolve(outputDir, 'consumer.user.js');
}
