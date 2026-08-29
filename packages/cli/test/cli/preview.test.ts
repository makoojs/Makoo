import { type PreviewServer, preview } from 'vite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewCommand } from '../../src/cli/commands/preview';

vi.mock('vite', () => ({
	preview: vi.fn()
}));

describe('previewCommand', () => {
	beforeEach(() => {
		vi.mocked(preview).mockReset();
	});

	it('starts the Vite preview server', async () => {
		const printUrls = vi.fn();
		const bindCLIShortcuts = vi.fn();
		vi.mocked(preview).mockResolvedValue({
			printUrls,
			bindCLIShortcuts
		} as unknown as PreviewServer);

		await previewCommand();

		expect(preview).toHaveBeenCalledWith();
		expect(printUrls).toHaveBeenCalledOnce();
		expect(bindCLIShortcuts).toHaveBeenCalledWith({ print: true });
	});
});
