import { describe, expect, it, vi } from 'vitest';
import { makoo } from '../../src/vite/makoo';
import { makooDev } from '../../src/vite/makooDev';

function getHookHandler<T extends (...args: never[]) => unknown>(
	hook: T | { handler: T } | undefined
): T | undefined {
	if (!hook) {
		return undefined;
	}
	if (typeof hook === 'function') {
		return hook;
	}
	return hook.handler;
}

describe('makooDev', () => {
	it('is an independent serve-only plugin', () => {
		const plugin = makooDev();

		expect(plugin.name).toBe('makoo:dev');
		expect(plugin.apply).toBe('serve');
		expect(plugin.enforce).toBe('pre');
		expect(plugin.configureServer).toBeUndefined();
	});

	it('leaves makoo() responsible only for vite-plugin-monkey', () => {
		const plugins = makoo({
			entry: './src/main.ts',
			app: { name: 'plugin-test', version: '0.0.1' },
			monkey: {}
		});

		expect(plugins.some((plugin) => plugin.name === 'monkey:config')).toBe(true);
		expect(plugins.some((plugin) => plugin.name === 'makoo:dev')).toBe(false);
	});

	it('resolves the public Core entry through Vite before returning its virtual module', async () => {
		const plugin = makooDev();
		const resolveId = getHookHandler(plugin.resolveId);
		if (!resolveId) {
			throw new Error('expected resolveId hook');
		}

		const ctx = {
			resolve: vi.fn().mockResolvedValue({ id: '/resolved/@makoojs/core.js' })
		};

		const result = await resolveId.call(ctx as never, '@makoojs/core', '/project/src/main.ts', {
			isEntry: false
		});

		expect(ctx.resolve).toHaveBeenCalledWith(
			'@makoojs/core',
			'/project/src/main.ts',
			expect.objectContaining({ skipSelf: true })
		);
		expect(result).toBe('\0virtual:makoo-dev');
	});
});
