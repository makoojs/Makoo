import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { createArtifactServer } from '../../../test/src/playwright/artifactServer';

it('serves sibling and nested artifact resources without exposing files outside the output directory', async () => {
	const temporary = await mkdtemp(resolve(tmpdir(), 'makoo-resource-check-'));
	const output = resolve(temporary, 'dist');
	const source =
		'// ==UserScript==\n// @require ./helper.js\n// @resource data ./assets/data.json\n// ==/UserScript==';
	const server = createArtifactServer(
		{ source, directory: output },
		{ '/counter': '<p>counter</p>' }
	);
	try {
		await mkdir(resolve(output, 'assets'), { recursive: true });
		await writeFile(resolve(output, 'helper.js'), 'globalThis.helper = true;');
		await writeFile(resolve(output, 'assets/data.json'), '{"count":1}');
		await writeFile(resolve(temporary, 'secret.txt'), 'private');
		await symlink(resolve(temporary, 'secret.txt'), resolve(output, 'escape.txt'));
		await new Promise<void>((accept) => server.listen(0, '127.0.0.1', accept));
		const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		const script = await fetch(`${origin}/userscript.user.js`);
		expect(await script.text()).toBe(source);
		const helper = await fetch(new URL('./helper.js', script.url));
		expect(helper.status).toBe(200);
		expect(helper.headers.get('content-type')).toContain('javascript');
		expect(await helper.text()).toBe('globalThis.helper = true;');
		expect(await (await fetch(`${origin}/assets/data.json?cache=1`)).json()).toEqual({
			count: 1
		});
		expect(await (await fetch(`${origin}/counter`)).text()).toBe('<p>counter</p>');
		for (const path of ['/escape.txt', '/..%2fsecret.txt']) {
			expect((await fetch(`${origin}${path}`)).status).toBe(403);
		}
		expect((await fetch(`${origin}/missing.js`)).status).toBe(404);
		expect((await fetch(`${origin}/%ZZ`)).status).toBe(400);
	} finally {
		server.closeAllConnections();
		await new Promise<void>((accept) => server.close(() => accept()));
		await rm(temporary, { recursive: true, force: true });
	}
});

it('cleans the server and temporary directory when userscript build times out', async () => {
	const directory = await mkdtemp(resolve(import.meta.dirname, 'harness-timeout-'));
	const checkpoint = resolve(directory, 'checkpoint.json');
	const require = createRequire(resolve(import.meta.dirname, '../../../test/package.json'));
	const cli = resolve(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
	const entry = resolve(import.meta.dirname, '../../../test/dist/playwright.js');
	let state: { outputDir: string; baseURL: string } | undefined;
	try {
		await writeFile(
			resolve(directory, 'playwright.config.mjs'),
			`export default { testDir: '.', timeout: 500, workers: 1, retries: 0, reporter: 'line', outputDir: './results' };`
		);
		await writeFile(
			resolve(directory, 'timeout.spec.mjs'),
			`
import { writeFile } from 'node:fs/promises';
import { test } from ${JSON.stringify(entry)};
test.use({ userscript: { build: async (input) => {
  await writeFile(${JSON.stringify(checkpoint)}, JSON.stringify(input));
  return new Promise(() => {});
} } });
test('stalled build', async ({ userscriptPage }) => { await userscriptPage.goto('/'); });
`
		);
		const result = await promisify(execFile)(
			process.execPath,
			[cli, 'test', '--config', resolve(directory, 'playwright.config.mjs')],
			{ timeout: 15_000 }
		).then(
			() => ({ code: 0, stdout: '' }),
			(error) => ({ code: error.code, stdout: error.stdout as string })
		);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain('while setting up "userscriptPage"');
		const checkpointState: { outputDir: string; baseURL: string } = JSON.parse(
			await readFile(checkpoint, 'utf8')
		);
		state = checkpointState;
		await expect(access(dirname(checkpointState.outputDir))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(fetch(checkpointState.baseURL)).rejects.toThrow();
	} finally {
		if (state) await rm(dirname(state.outputDir), { recursive: true, force: true });
		await rm(directory, { recursive: true, force: true });
	}
}, 20_000);
