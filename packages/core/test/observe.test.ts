import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountAdapter, ObservationNotice } from '../src';
import { createMakoo, inject, listen, MakooError, MakooErrorCode } from '../src';

describe('instance observation', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	function adapter(
		mount: MountAdapter['mount'] = () => 'handle',
		unmount: MountAdapter['unmount'] = () => {}
	): MountAdapter {
		return { name: 'plain', mount, unmount };
	}

	it('notifies injection-removed only after a successful remove unregisters the name', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const core = createMakoo();
		core.useAdapter(adapter());
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const notices: ObservationNotice[] = [];
		core.observe((notice) => {
			expect(() => core.command('panel')).toThrow(
				expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
			);
			notices.push(notice);
		});
		await core.command('panel').remove();
		expect(notices).toEqual([{ type: 'injection-removed', name: 'panel' }]);
	});

	it('does not notify injection-removed when cleanup failure retains the name', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const core = createMakoo();
		const unmount = vi.fn(() => {
			throw new Error('unmount failed');
		});
		core.useAdapter(adapter(() => 'handle', unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const notices: ObservationNotice[] = [];
		core.observe((notice) => {
			notices.push(notice);
		});
		await expect(core.command('panel').remove()).rejects.toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED
		});
		expect(core.statusHandle('panel').getSnapshot()).toBe('failed');
		expect(notices).toEqual([]);
	});

	it('does not notify after unsubscribe', async () => {
		const button = document.createElement('button');
		button.id = 'play';
		document.body.append(button);
		const core = createMakoo();
		core.apply([
			listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
		]);
		const notices: ObservationNotice[] = [];
		const stop = core.observe((notice) => {
			notices.push(notice);
		});
		stop();
		await core.command('click').remove();
		expect(notices).toEqual([]);
	});

	it('notifies in registration order and keeps mid-fan-out subscribers off the current notice', async () => {
		const button = document.createElement('button');
		button.id = 'play';
		document.body.append(button);
		const core = createMakoo();
		core.apply([
			listen({ name: 'one', listenAt: '#play', type: 'click', callback: vi.fn() }),
			listen({ name: 'two', listenAt: '#play', type: 'click', callback: vi.fn() })
		]);
		const order: string[] = [];
		const midFanOut: ObservationNotice[] = [];
		core.observe(() => {
			order.push('first');
			core.observe((notice) => {
				midFanOut.push(notice);
			});
		});
		core.observe(() => {
			order.push('second');
		});
		await core.command('one').remove();
		expect(order).toEqual(['first', 'second']);
		expect(midFanOut).toEqual([]);
		await core.command('two').remove();
		expect(midFanOut).toEqual([{ type: 'injection-removed', name: 'two' }]);
	});

	it('on dispose emits injection-removed for each success then one instance-disposed', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		const play = document.createElement('button');
		play.id = 'play';
		document.body.append(host, play);
		const core = createMakoo();
		core.useAdapter(adapter());
		core.apply([
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
			listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
		]);
		const notices: ObservationNotice[] = [];
		core.observe((notice) => {
			notices.push(notice);
		});
		await core.dispose();
		expect(notices).toEqual([
			{ type: 'injection-removed', name: 'panel' },
			{ type: 'injection-removed', name: 'click' },
			{ type: 'instance-disposed' }
		]);
		expect(() => core.observe(() => {})).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INSTANCE_DISPOSED })
		);
	});

	it('emits instance-disposed once across nested and repeated dispose', async () => {
		const play = document.createElement('button');
		play.id = 'play';
		document.body.append(play);
		const core = createMakoo();
		core.apply([
			listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
		]);
		const disposed: ObservationNotice[] = [];
		core.observe((notice) => {
			if (notice.type === 'injection-removed') {
				void core.dispose();
			}
			if (notice.type === 'instance-disposed') disposed.push(notice);
		});
		const first = core.dispose();
		const second = core.dispose();
		await expect(first).resolves.toBeUndefined();
		await expect(second).resolves.toBeUndefined();
		expect(disposed).toEqual([{ type: 'instance-disposed' }]);
	});

	it('emits diagnostic for status subscriber failures without changing status or lastError', async () => {
		const play = document.createElement('button');
		play.id = 'play';
		document.body.append(play);
		const core = createMakoo();
		core.apply([
			listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
		]);
		const status = core.statusHandle('click');
		status.subscribe(() => {
			throw new Error('subscriber boom');
		});
		const diagnostics: ObservationNotice[] = [];
		core.observe((notice) => {
			if (notice.type === 'diagnostic') diagnostics.push(notice);
		});
		await core.command('click').stop();
		expect(status.getSnapshot()).toBe('idle');
		expect(status.lastError).toBeUndefined();
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			type: 'diagnostic',
			name: 'click',
			error: expect.objectContaining({
				code: MakooErrorCode.STATE_SUBSCRIBER_FAILED,
				cause: expect.objectContaining({ message: 'subscriber boom' })
			})
		});
		expect(diagnostics[0]?.type === 'diagnostic' && diagnostics[0].error).toBeInstanceOf(
			MakooError
		);
	});

	it('keeps other observers running and emits INSTANCE_OBSERVER_FAILED without chaining', async () => {
		const play = document.createElement('button');
		play.id = 'play';
		document.body.append(play);
		const core = createMakoo();
		core.apply([
			listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
		]);
		const seen: string[] = [];
		const diagnostics: ObservationNotice[] = [];
		core.observe((notice) => {
			if (notice.type === 'injection-removed') {
				seen.push('first');
				throw new Error('observer boom');
			}
			if (notice.type === 'diagnostic') {
				seen.push('diagnostic');
				diagnostics.push(notice);
				throw new Error('diagnostic boom');
			}
		});
		core.observe((notice) => {
			if (notice.type === 'injection-removed') seen.push('second');
		});
		await core.command('click').remove();
		expect(seen).toEqual(['first', 'diagnostic', 'second']);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			type: 'diagnostic',
			error: expect.objectContaining({
				code: MakooErrorCode.INSTANCE_OBSERVER_FAILED,
				cause: expect.objectContaining({ message: 'observer boom' })
			})
		});
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({
				code: MakooErrorCode.INSTANCE_OBSERVER_FAILED,
				cause: expect.objectContaining({ message: 'observer boom' })
			})
		);
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({
				cause: expect.objectContaining({ message: 'diagnostic boom' })
			})
		);
	});
});
