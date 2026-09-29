import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const execute = promisify(execFile);

it('consumes the test tarball in an independent userscript project', async () => {
	const root = await mkdtemp(resolve(tmpdir(), 'makoo-test-consumer-'));
	const run = (command: string, args: string[]) =>
		execute(command, args, {
			cwd: root,
			timeout: 60_000,
			maxBuffer: 2 * 1024 * 1024,
			// Global runner installations must not satisfy missing consumer dependencies.
			env: { ...process.env, NODE_PATH: '' }
		}).catch((error) => {
			throw new Error(
				`${command} ${args.join(' ')} failed\n${error.stdout}\n${error.stderr}`,
				{
					cause: error
				}
			);
		});
	try {
		const packed = await execute(
			'npm',
			['pack', '--json', '--ignore-scripts', '--pack-destination', root],
			{ cwd: resolve(import.meta.dirname, '../../../test'), timeout: 30_000 }
		);
		const [{ filename }] = JSON.parse(packed.stdout) as { filename: string }[];
		const manifest = {
			name: 'standalone-userscript-consumer',
			private: true,
			type: 'module',
			dependencies: { '@makoojs/test': `file:./${filename}` },
			devDependencies: {}
		};
		await writeFile(resolve(root, 'package.json'), JSON.stringify(manifest));
		await writeFile(resolve(root, '.npmrc'), 'auto-install-peers=false\n');
		await cp(resolve(import.meta.dirname, '../standalone'), root, { recursive: true });
		await run('pnpm', ['install', '--offline', '--ignore-scripts']);
		await run(process.execPath, [
			'--input-type=module',
			'-e',
			`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readUserscript } from '@makoojs/test';
import { parseMetadata } from '@makoojs/test/metadata';
const require = createRequire(import.meta.url);
const artifact = await readUserscript('./demo.user.js');
assert.equal(parseMetadata(artifact.source).fields.name[0], 'standalone-counter');
assert.equal(typeof require('@makoojs/test').readUserscript, 'function');
assert.equal(typeof require('@makoojs/test/metadata').parseMetadata, 'function');
const packageRequire = createRequire(require.resolve('@makoojs/test'));
for (const dependency of ['vitest', '@playwright/test', '@makoojs/core']) {
 assert.throws(() => packageRequire.resolve(dependency), { code: 'MODULE_NOT_FOUND' }, dependency);
}
`
		]);
		// Reuse the pinned toolchain; only the package under test comes from its tarball.
		const toolchain = resolve(import.meta.dirname, '../../../../node_modules');
		manifest.devDependencies = {
			vitest: `link:${resolve(toolchain, 'vitest')}`,
			'@playwright/test': `link:${resolve(import.meta.dirname, '../../../test/node_modules/@playwright/test')}`,
			typescript: `link:${resolve(toolchain, 'typescript')}`,
			'@types/node': `link:${resolve(toolchain, '@types/node')}`
		};
		await writeFile(resolve(root, 'package.json'), JSON.stringify(manifest));
		await run('pnpm', ['install', '--offline', '--ignore-scripts']);
		const artifacts = await run('pnpm', ['exec', 'vitest', 'run']);
		expect(artifacts.stdout).toContain('1 passed');
		const browser = await run('pnpm', ['exec', 'playwright', 'test', '--list']);
		expect(browser.stdout).toContain('updates the standalone counter');
		await cp(resolve(import.meta.dirname, 'api.types.ts'), resolve(root, 'api.types.ts'));
		await cp(resolve(import.meta.dirname, 'api.types.cts'), resolve(root, 'api.types.cts'));
		for (const resolution of ['NodeNext', 'Bundler']) {
			await writeFile(
				resolve(root, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						noEmit: true,
						strict: true,
						target: 'ES2023',
						module: resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
						moduleResolution: resolution,
						types: ['node']
					},
					include: resolution === 'NodeNext' ? ['*.ts', '*.cts'] : ['*.ts']
				})
			);
			await run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json']);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 180_000);
