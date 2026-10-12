import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTempProjects, trackProject, withCwd } from './utils/tempProject';

const execSyncMock = vi.fn();

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	return {
		...actual,
		default: {
			...actual,
			execSync: (...args: unknown[]) => execSyncMock(...args)
		},
		execSync: (...args: unknown[]) => execSyncMock(...args)
	};
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.resetModules();
	await cleanupTempProjects();
});

beforeEach(() => {
	process.env.NODE_ENV = 'test';
	delete process.env.MAKOO_DEBUG_LOCAL_DEPS;
	execSyncMock.mockReset();
	execSyncMock.mockReturnValue(Buffer.from(''));
});

function mockProjectPrompts(projectName: string, directoryAction?: 'cancel' | 'remove' | 'ignore') {
	const input = vi
		.fn()
		.mockResolvedValueOnce(projectName)
		.mockResolvedValueOnce(projectName)
		.mockResolvedValueOnce('0.0.1')
		.mockResolvedValueOnce('npm/makoo')
		.mockResolvedValueOnce('https://www.google.com/');
	const select = vi.fn();

	if (directoryAction) {
		select.mockResolvedValueOnce(directoryAction);
	}

	select.mockResolvedValueOnce('ts').mockResolvedValueOnce('Vue');

	return {
		input,
		select,
		confirm: vi.fn().mockResolvedValue(false)
	};
}

describe('createMakoo', () => {
	it('cancels when target directory is non-empty and user chooses cancel', async () => {
		const root = await trackProject({
			'existing-project/keep.txt': 'keep'
		});
		const prompts = mockProjectPrompts('existing-project', 'cancel');
		const generateVueTemplate = vi.fn();
		const exitSignal = Object.assign(new Error('exit'), { name: 'ExitPromptError' });
		const exitSpy = vi
			.spyOn(process, 'exit')
			.mockImplementationOnce(() => {
				throw exitSignal;
			})
			.mockImplementation(() => undefined as never);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		vi.doMock('@inquirer/prompts', () => prompts);
		vi.doMock('../src/template/vue-template', () => ({ generateVueTemplate }));
		vi.doMock('../src/template/react-template', () => ({ generateReactTemplate: vi.fn() }));

		await withCwd(root, async () => {
			const { createMakoo } = await import('../src/index');
			await createMakoo();
		});

		expect(exitSpy).toHaveBeenCalledWith(0);
		expect(generateVueTemplate).not.toHaveBeenCalled();
		expect(existsSync(path.join(root, 'existing-project', 'keep.txt'))).toBe(true);
		expect(logSpy).toHaveBeenCalledWith('\x1b[31m\n❌ Operation cancelled.\x1b[0m');
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('removes existing files before generating when user chooses remove', async () => {
		const root = await trackProject({
			'remove-project/keep.txt': 'keep'
		});
		const prompts = mockProjectPrompts('remove-project', 'remove');
		const generateVueTemplate = vi.fn();

		vi.doMock('@inquirer/prompts', () => prompts);
		vi.doMock('../src/template/vue-template', () => ({ generateVueTemplate }));
		vi.doMock('../src/template/react-template', () => ({ generateReactTemplate: vi.fn() }));

		await withCwd(root, async () => {
			const { createMakoo } = await import('../src/index');
			await createMakoo();
		});

		expect(generateVueTemplate).toHaveBeenCalledWith(
			expect.objectContaining({
				projectName: 'remove-project',
				dependencyMode: 'npm',
				framework: 'Vue'
			})
		);
		expect(existsSync(path.join(root, 'remove-project', 'keep.txt'))).toBe(false);
	});

	it('keeps existing files when user chooses ignore', async () => {
		const root = await trackProject({
			'ignore-project/keep.txt': 'keep'
		});
		const prompts = mockProjectPrompts('ignore-project', 'ignore');
		const generateVueTemplate = vi.fn((data: { projectName: string }) => {
			const generatedPath = path.join(root, data.projectName, 'generated.txt');
			writeFileSync(generatedPath, 'generated', 'utf-8');
		});

		vi.doMock('@inquirer/prompts', () => prompts);
		vi.doMock('../src/template/vue-template', () => ({ generateVueTemplate }));
		vi.doMock('../src/template/react-template', () => ({ generateReactTemplate: vi.fn() }));

		await withCwd(root, async () => {
			const { createMakoo } = await import('../src/index');
			await createMakoo();
		});

		expect(generateVueTemplate).toHaveBeenCalledWith(
			expect.objectContaining({
				projectName: 'ignore-project',
				dependencyMode: 'npm',
				framework: 'Vue'
			})
		);
		expect(readFileSync(path.join(root, 'ignore-project', 'keep.txt'), 'utf-8')).toBe('keep');
		expect(readFileSync(path.join(root, 'ignore-project', 'generated.txt'), 'utf-8')).toBe(
			'generated'
		);
	});

	it('prompts to select package manager when none is detected and avoids null in message', async () => {
		delete process.env.npm_config_user_agent;
		const root = await trackProject({});
		const input = vi
			.fn()
			.mockResolvedValueOnce('manual-pkg-project')
			.mockResolvedValueOnce('manual-pkg-project')
			.mockResolvedValueOnce('0.0.1')
			.mockResolvedValueOnce('npm/makoo')
			.mockResolvedValueOnce('https://www.google.com/');
		const select = vi
			.fn()
			.mockResolvedValueOnce('ts')
			.mockResolvedValueOnce('Vue')
			.mockResolvedValueOnce('bun');
		const confirm = vi.fn().mockResolvedValue(false);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		vi.doMock('@inquirer/prompts', () => ({ input, select, confirm }));
		execSyncMock.mockImplementation(() => {
			throw new Error('command not found');
		});
		vi.doMock('../src/template/vue-template', () => ({ generateVueTemplate: vi.fn() }));
		vi.doMock('../src/template/react-template', () => ({ generateReactTemplate: vi.fn() }));

		await withCwd(root, async () => {
			const { createMakoo } = await import('../src/index');
			await createMakoo();
		});

		expect(select).toHaveBeenCalledWith(
			expect.objectContaining({
				message: '📦 Select a package manager:',
				choices: expect.arrayContaining([expect.objectContaining({ value: 'bun' })])
			})
		);
		expect(confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				message: '📥  Install with bun and start now?'
			})
		);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Run 'bun install' then 'bun dev'")
		);
	});

	it('detects bun from npm_config_user_agent during creation', async () => {
		process.env.npm_config_user_agent = 'bun/1.1.20 npm/? node/v22.0.0 darwin x64';
		const root = await trackProject({});
		const prompts = mockProjectPrompts('bun-project');
		vi.doMock('@inquirer/prompts', () => prompts);
		vi.doMock('../src/template/vue-template', () => ({ generateVueTemplate: vi.fn() }));
		vi.doMock('../src/template/react-template', () => ({ generateReactTemplate: vi.fn() }));

		await withCwd(root, async () => {
			const { createMakoo } = await import('../src/index');
			await createMakoo();
		});

		expect(prompts.confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				message: '📥  Install with bun and start now?'
			})
		);
	});

	it('uses platform-appropriate lookup command when checking installed package managers', async () => {
		delete process.env.npm_config_user_agent;
		const root = await trackProject({});
		const prompts = mockProjectPrompts('cmd-lookup-project');
		vi.doMock('@inquirer/prompts', () => prompts);
		vi.doMock('../src/template/vue-template', () => ({ generateVueTemplate: vi.fn() }));
		vi.doMock('../src/template/react-template', () => ({ generateReactTemplate: vi.fn() }));

		await withCwd(root, async () => {
			const { createMakoo } = await import('../src/index');
			await createMakoo();
		});

		const expectedPrefix = process.platform === 'win32' ? 'where ' : 'which ';
		expect(execSyncMock).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^${expectedPrefix}`)),
			{ stdio: 'ignore' }
		);
	});
});
