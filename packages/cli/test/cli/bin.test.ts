import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { mergeConfig } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCommand } from '../../src/commands/build';
import { devCommand } from '../../src/commands/dev';
import { previewCommand } from '../../src/commands/preview';
import { cleanupTempProjects, trackProject } from '../utils/tempProject';

const state = vi.hoisted(() => ({ args: [] as string[] }));

vi.mock('cac', async (importOriginal) => {
	const { default: cac } = await importOriginal<typeof import('cac')>();
	return {
		default: (name: string) => {
			const cli = cac(name);
			const parse = cli.parse.bind(cli);
			cli.parse = () => parse(['node', 'makoo', ...state.args]);
			return cli;
		}
	};
});

vi.mock('../../src/commands/build', () => ({ buildCommand: vi.fn() }));
vi.mock('../../src/commands/dev', () => ({ devCommand: vi.fn() }));
vi.mock('../../src/commands/preview', () => ({ previewCommand: vi.fn() }));
vi.mock('../../src/commands/version', () => ({
	loadCliVersion: vi.fn().mockResolvedValue('0.4.1')
}));

async function run(...args: string[]) {
	state.args = args;
	await import('../../src/commands/bin');
}

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.spyOn(process, 'on').mockImplementation(() => process);
	process.exitCode = undefined;
});

afterEach(() => vi.restoreAllMocks());

describe('Vite CLI options', () => {
	it('passes common and dev options into their Vite config fields', async () => {
		await run(
			'dev',
			'app',
			'-c',
			'vite.custom.ts',
			'-m',
			'staging',
			'--base',
			'/tools/',
			'-l',
			'warn',
			'--no-clearScreen',
			'--configLoader',
			'runner',
			'--host',
			'0',
			'--port',
			'5174',
			'--open',
			'/install',
			'--strictPort',
			'--force'
		);
		expect(devCommand).toHaveBeenCalledTimes(1);
		expect(devCommand).toHaveBeenCalledWith({
			root: 'app',
			configFile: 'vite.custom.ts',
			mode: 'staging',
			base: '/tools/',
			logLevel: 'warn',
			clearScreen: false,
			configLoader: 'runner',
			server: { host: '0', port: 5174, open: '/install', strictPort: true },
			forceOptimizeDeps: true
		});
	});

	it.each([
		['dev', devCommand],
		['build', buildCommand],
		['preview', previewCommand]
	] as const)('keeps omitted %s options from overriding the project config', async (command, handler) => {
		await run(command);
		const config = vi.mocked(handler).mock.calls[0][0];
		expect(
			mergeConfig(
				{
					mode: 'custom',
					build: { outDir: 'release', minify: false, watch: { exclude: 'ignored' } },
					preview: { port: 7000, open: '/existing' },
					clearScreen: false,
					server: { host: 'localhost', port: 6000, open: '/existing', strictPort: true }
				},
				config ?? {}
			)
		).toMatchObject({
			mode: 'custom',
			build: { outDir: 'release', minify: false, watch: { exclude: 'ignored' } },
			preview: { port: 7000, open: '/existing' },
			clearScreen: false,
			server: { host: 'localhost', port: 6000, open: '/existing', strictPort: true }
		});
	});

	it('handles bare host and explicitly disabled server flags', async () => {
		await run('dev', '--host', '--no-open', '--no-strictPort');
		expect(devCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				server: { host: true, port: undefined, open: false, strictPort: false }
			})
		);
	});

	it('normalizes build flags for the Vite build API', async () => {
		await run(
			'build',
			'app',
			'--target',
			'es2022',
			'--outDir',
			'release',
			'--no-minify',
			'--manifest',
			'manifest.json',
			'--no-emptyOutDir',
			'-w'
		);
		expect(buildCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				root: 'app',
				build: {
					target: 'es2022',
					outDir: 'release',
					minify: false,
					manifest: 'manifest.json',
					emptyOutDir: false,
					watch: {}
				}
			})
		);
	});

	it('passes preview networking separately from the output directory', async () => {
		await run(
			'preview',
			'app',
			'--outDir',
			'release',
			'--port',
			'4174',
			'--host',
			'localhost',
			'--no-open',
			'--strictPort',
			'--mode',
			'staging'
		);
		expect(previewCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				root: 'app',
				mode: 'staging',
				build: { outDir: 'release' },
				preview: { host: 'localhost', port: 4174, open: false, strictPort: true }
			})
		);
	});

	it('rejects options that do not belong to the selected command', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await run('preview', '--force');
		expect(error).toHaveBeenNthCalledWith(1, expect.stringContaining('Unknown option'));
		expect(process.exitCode).toBe(1);
		expect(previewCommand).not.toHaveBeenCalled();
	});

	it('uses the last repeated option and preserves an empty base', async () => {
		await run('dev', '--port', '5000', '--port', '5001', '--base', '');
		expect(devCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				base: '',
				server: expect.objectContaining({ port: 5001 })
			})
		);
	});
});

describe('Command handling', () => {
	it('prints help and exits cleanly with no arguments', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		await run();
		expect(info).toHaveBeenCalledWith(expect.stringContaining('Commands'));
		expect(process.exitCode).toBeUndefined();
		expect(devCommand).not.toHaveBeenCalled();
	});

	it('prints help when only global flags are passed', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		await run('--logLevel', 'warn');
		expect(info).toHaveBeenCalledWith(expect.stringContaining('Commands'));
		expect(process.exitCode).toBeUndefined();
	});

	it('reports an unknown command with a suggestion and exit code 1', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await run('buid');
		expect(error).toHaveBeenCalledTimes(1);
		const [message] = error.mock.calls[0];
		expect(message).toContain('[makoo] Unknown command "buid". Did you mean "build"?');
		expect(message).toContain('makoo --help');
		expect(process.exitCode).toBe(1);
		expect(buildCommand).not.toHaveBeenCalled();
	});

	it('reports an unknown command without a suggestion', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await run('foo');
		expect(error).toHaveBeenCalledTimes(1);
		const [message] = error.mock.calls[0];
		expect(message).toContain('Unknown command "foo".');
		expect(message).not.toContain('Did you mean');
		expect(message).toContain('makoo --help');
		expect(process.exitCode).toBe(1);
	});

	it.each([
		['dev', '--bogus'],
		['dev', '--cors'],
		['dev', '--no-cors'],
		['build', '--sourcemap'],
		['build', '--no-sourcemap'],
		['build', '--assetsDir', 'static'],
		['build', '--assetsInlineLimit', '0']
	])('rejects %s %j as an unknown option', async (command, ...args) => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await run(command, ...args);
		expect(error).toHaveBeenCalledTimes(1);
		const [message] = error.mock.calls[0];
		expect(message).toContain('Unknown option');
		expect(message).not.toContain('\n');
		expect(process.exitCode).toBe(1);
	});

	it('rejects an unknown option without a command', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await run('--bogus');
		expect(error).toHaveBeenCalledTimes(1);
		const [message] = error.mock.calls[0];
		expect(message).toContain('Unknown option');
		expect(message).not.toContain('\n');
		expect(process.exitCode).toBe(1);
	});

	it('reports the unknown command before its options', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await run('foo', '--bogus');
		const [message] = error.mock.calls[0];
		expect(message).toContain('Unknown command "foo".');
		expect(process.exitCode).toBe(1);
	});
});

describe('CLI process', () => {
	const execFileAsync = promisify(execFile);
	const repoRoot = path.resolve(__dirname, '../../../..');
	let binPath: string;

	beforeAll(async () => {
		const root = await trackProject({});
		const outDir = path.join(root, 'cli');
		await execFileAsync(
			process.execPath,
			[
				path.join(repoRoot, 'node_modules/tsup/dist/cli-default.js'),
				'packages/cli/src/commands/bin.ts',
				'--no-config',
				'--format',
				'esm',
				'--no-splitting',
				'--external',
				'vite',
				'--out-dir',
				outDir,
				'--silent'
			],
			{ cwd: repoRoot, timeout: 30_000 }
		);
		binPath = path.join(outDir, 'bin.js');
	}, 45_000);

	afterAll(async () => {
		await cleanupTempProjects();
	});

	const runCli = (args: string[]) =>
		execFileAsync(process.execPath, [binPath, ...args], { cwd: repoRoot, timeout: 10_000 });

	it('prints help and exits 0 with no arguments', async () => {
		const { stdout } = await runCli([]);
		expect(stdout).toContain('Commands');
	});

	it.each([
		[['foo'], 'Unknown command "foo"'],
		[['buid'], 'Did you mean "build"'],
		[['--bogus'], 'Unknown option'],
		[['dev', '--cors'], 'Unknown option'],
		[['build', '--sourcemap'], 'Unknown option'],
		[['build', '--assetsDir', 'static'], 'Unknown option'],
		[['preview', '--force'], 'Unknown option']
	])('fails with exit 1 for %j', async (args, message) => {
		await expect(runCli(args)).rejects.toMatchObject({
			code: 1,
			stderr: expect.stringContaining(message)
		});
	});

	it('prints a single-line error for an unknown option', async () => {
		const result = (await runCli(['dev', '--bogus']).catch((e: unknown) => e)) as {
			code?: number;
			stderr?: string;
		};
		expect(result.code).toBe(1);
		expect(result.stderr?.trim().split('\n')).toHaveLength(1);
	});
});
