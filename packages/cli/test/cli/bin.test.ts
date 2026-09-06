import type { CAC } from 'cac';
import { mergeConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCommand } from '../../src/cli/commands/build';
import { devCommand } from '../../src/cli/commands/dev/dev';
import { previewCommand } from '../../src/cli/commands/preview';

const state = vi.hoisted(() => ({ args: [] as string[], cli: undefined as CAC | undefined }));

vi.mock('cac', async (importOriginal) => {
	const { default: cac } = await importOriginal<typeof import('cac')>();
	return {
		default: (name: string) => {
			const cli = cac(name);
			const parse = cli.parse.bind(cli);
			cli.parse = () => parse(['node', 'makoo', ...state.args], { run: false });
			state.cli = cli;
			return cli;
		}
	};
});

vi.mock('../../src/cli/commands/build', () => ({ buildCommand: vi.fn() }));
vi.mock('../../src/cli/commands/dev/dev', () => ({ devCommand: vi.fn() }));
vi.mock('../../src/cli/commands/preview', () => ({ previewCommand: vi.fn() }));
vi.mock('../../src/cli/version', () => ({ loadCliVersion: vi.fn().mockResolvedValue('0.4.1') }));

async function run(...args: string[]) {
	state.args = args;
	await import('../../src/cli/bin');
	if (!state.cli) throw new Error('CLI was not created');
	await state.cli.runMatchedCommand();
}

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.spyOn(process, 'on').mockImplementation(() => process);
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
			'--cors',
			'--strictPort',
			'--force'
		);
		expect(devCommand).toHaveBeenCalledWith({
			root: 'app',
			configFile: 'vite.custom.ts',
			mode: 'staging',
			base: '/tools/',
			logLevel: 'warn',
			clearScreen: false,
			configLoader: 'runner',
			server: { host: '0', port: 5174, open: '/install', cors: true, strictPort: true },
			forceOptimizeDeps: true
		});
	});

	it('keeps omitted options from overriding the project config', async () => {
		await run('dev');
		const config = vi.mocked(devCommand).mock.calls[0][0];
		expect(
			mergeConfig(
				{
					mode: 'custom',
					clearScreen: false,
					server: { host: 'localhost', port: 6000, open: '/existing', strictPort: true }
				},
				config ?? {}
			)
		).toMatchObject({
			mode: 'custom',
			clearScreen: false,
			server: { host: 'localhost', port: 6000, open: '/existing', strictPort: true }
		});
	});

	it('handles bare host and explicitly disabled server flags', async () => {
		await run('dev', '--host', '--no-open', '--no-cors', '--no-strictPort');
		expect(devCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				server: { host: true, port: undefined, open: false, cors: false, strictPort: false }
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
			'--assetsDir',
			'static',
			'--assetsInlineLimit',
			'0',
			'--sourcemap',
			'hidden',
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
					assetsDir: 'static',
					assetsInlineLimit: 0,
					sourcemap: 'hidden',
					minify: false,
					manifest: 'manifest.json',
					emptyOutDir: false,
					watch: {}
				}
			})
		);
	});

	it.each([
		[['--sourcemap'], true],
		[['--sourcemap', 'true'], true],
		[['--sourcemap', 'false'], false],
		[['--no-sourcemap'], false]
	])('normalizes source map option %j', async (args, expected) => {
		await run('build', ...args);
		expect(buildCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				build: expect.objectContaining({ sourcemap: expected })
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
		await expect(run('preview', '--force')).rejects.toThrow('Unknown option');
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
