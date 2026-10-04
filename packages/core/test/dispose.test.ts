import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountAdapter } from '../src';
import { createMakoo, ErrorCode, inject, listen, MakooError, MakooErrorCode } from '../src';

describe('core disposal', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	function adapter(
		mount: MountAdapter['mount'],
		unmount: MountAdapter['unmount'] = () => {}
	): MountAdapter {
		return { name: 'plain', mount, unmount };
	}

	it('closes the instance before cleanup finishes and rejects later commands', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const button = document.createElement('button');
		button.id = 'play';
		document.body.append(button);
		const unmount = vi.fn(() => {
			expect(() =>
				core.apply([
					listen({ name: 'later', listenAt: '#play', type: 'click', callback: vi.fn() })
				])
			).toThrow(expect.objectContaining({ code: ErrorCode.INSTANCE_DISPOSED }));
			expect(() =>
				core.useAdapter({ name: 'other', mount: () => {}, unmount: () => {} })
			).toThrow(expect.objectContaining({ code: ErrorCode.INSTANCE_DISPOSED }));
			expect(() => panel.start()).toThrow(
				expect.objectContaining({ code: ErrorCode.INSTANCE_DISPOSED })
			);
		});
		const core = createMakoo();
		core.useAdapter(adapter(() => ({ mounted: true }), unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.command('panel');
		const disposal = core.dispose();
		expect(() => panel.start()).toThrow(
			expect.objectContaining({ code: ErrorCode.INSTANCE_DISPOSED })
		);
		expect(() =>
			core.apply([
				listen({ name: 'later', listenAt: '#play', type: 'click', callback: vi.fn() })
			])
		).toThrow(expect.objectContaining({ code: ErrorCode.INSTANCE_DISPOSED }));
		await disposal;
		expect(unmount).toHaveBeenCalledOnce();
		expect(() => core.command('panel')).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_NOT_FOUND })
		);
		expect(() => core.status('panel')).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_NOT_FOUND })
		);
	});

	it('stops waiting, bound, and mounted injections without reviving them', async () => {
		vi.useFakeTimers();
		const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
		const host = document.createElement('section');
		host.id = 'host';
		const play = document.createElement('button');
		play.id = 'play';
		document.body.append(host, play);
		const waiting = vi.fn();
		const bound = vi.fn();
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle', unmount));
		core.apply([
			listen({
				name: 'waiting',
				listenAt: '#missing',
				type: 'click',
				callback: waiting,
				timeout: 50
			}),
			listen({ name: 'bound', listenAt: '#play', type: 'click', callback: bound }),
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })
		]);
		play.click();
		expect(bound).toHaveBeenCalledOnce();
		const disposal = core.dispose();
		const late = document.createElement('button');
		late.id = 'missing';
		document.body.append(late);
		await vi.advanceTimersByTimeAsync(50);
		late.click();
		play.click();
		expect(waiting).not.toHaveBeenCalled();
		expect(bound).toHaveBeenCalledOnce();
		expect(unmount).toHaveBeenCalledOnce();
		expect(disconnect).toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		await disposal;
	});

	it('keeps a failed cleanup registered and does not rewrite its diagnostic', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const unmount = vi.fn(() => {
			throw new Error('unmount failed');
		});
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle', unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.command('panel');
		const disposal = core.dispose();
		const repeated = core.dispose();
		expect(repeated).toBe(disposal);
		await expect(disposal).rejects.toMatchObject({
			code: MakooErrorCode.INSTANCE_CLEANUP_FAILED,
			errors: [
				expect.objectContaining({
					code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
					errors: [expect.objectContaining({ code: MakooErrorCode.UNMOUNT_FAILED })]
				})
			]
		});
		await expect(repeated).rejects.toBeInstanceOf(MakooError);
		expect(unmount).toHaveBeenCalledOnce();
		expect(core.command('panel')).toBe(panel);
		const diagnostic = core.status('panel').lastError;
		expect(diagnostic?.code).toBe(MakooErrorCode.INJECTION_CLEANUP_FAILED);
		expect(() => panel.start()).toThrow(
			expect.objectContaining({ code: ErrorCode.INSTANCE_DISPOSED })
		);
		await expect(core.dispose()).rejects.toMatchObject({
			code: MakooErrorCode.INSTANCE_CLEANUP_FAILED
		});
		expect(unmount).toHaveBeenCalledOnce();
		expect(core.status('panel').lastError).toBe(diagnostic);
	});

	it('preserves an earlier execution error when disposal cleanup also fails', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const core = createMakoo();
		core.useAdapter(
			adapter(({ container }) => {
				vi.spyOn(container, 'remove').mockImplementation(() => {
					throw new Error('remove failed');
				});
				throw new Error('mount failed');
			})
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.command('panel');
		await vi.waitFor(() => expect(core.status('panel').getSnapshot()).toBe('failed'));
		const diagnostic = core.status('panel').lastError;
		expect(diagnostic).toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: [
				expect.objectContaining({ code: MakooErrorCode.MOUNT_FAILED }),
				expect.objectContaining({ code: MakooErrorCode.CONTAINER_REMOVE_FAILED })
			]
		});
		await expect(core.dispose()).rejects.toMatchObject({
			code: MakooErrorCode.INSTANCE_CLEANUP_FAILED,
			errors: [diagnostic]
		});
		expect(core.status('panel').lastError).toBe(diagnostic);
		expect(core.command('panel')).toBe(panel);
	});

	it('continues disposing other injections when one cleanup fails', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const unmountPanel = vi.fn(() => {
			throw new Error('unmount failed');
		});
		const unmountOther = vi.fn();
		const core = createMakoo();
		core.useAdapter({
			name: 'plain',
			mount: ({ component }) => component,
			unmount: (handle) => {
				if (handle === 'panel') unmountPanel();
				else unmountOther();
			}
		});
		core.apply([
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: 'panel' }),
			inject({ name: 'other', injectAt: '#host', adapter: 'plain', component: 'other' })
		]);
		await expect(core.dispose()).rejects.toMatchObject({
			errors: [
				expect.objectContaining({
					errors: [expect.objectContaining({ code: MakooErrorCode.UNMOUNT_FAILED })]
				})
			]
		});
		expect(unmountPanel).toHaveBeenCalledOnce();
		expect(unmountOther).toHaveBeenCalledOnce();
		expect(() => core.command('other')).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_NOT_FOUND })
		);
		expect(core.status('panel').getSnapshot()).toBe('failed');
	});

	it('leaves another core instance running', async () => {
		const play = document.createElement('button');
		play.id = 'play';
		document.body.append(play);
		const firstCallback = vi.fn();
		const secondCallback = vi.fn();
		const first = createMakoo();
		const second = createMakoo();
		first.apply([
			listen({ name: 'play', listenAt: '#play', type: 'click', callback: firstCallback })
		]);
		second.apply([
			listen({ name: 'play', listenAt: '#play', type: 'click', callback: secondCallback })
		]);
		await first.dispose();
		play.click();
		expect(firstCallback).not.toHaveBeenCalled();
		expect(secondCallback).toHaveBeenCalledOnce();
		expect(() => first.command('play')).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_NOT_FOUND })
		);
		expect(second.status('play').getSnapshot()).toBe('bound');
		await second.command('play').remove();
	});
});
