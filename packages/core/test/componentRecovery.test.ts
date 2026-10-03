import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakoo, type InjectionCommand, inject } from '../src';

describe('injection target recovery', () => {
	const controls: InjectionCommand[] = [];
	beforeEach(() => {
		document.body.replaceChildren();
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(async () => {
		for (const control of controls.splice(0)) await control.remove().catch(() => {});
		vi.restoreAllMocks();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	function mountInjection(reinject = false, timeout?: number) {
		const parent = document.createElement('section');
		const host = document.createElement('div');
		host.id = 'host';
		parent.append(host);
		document.body.append(parent);
		const mount = vi.fn(({ container }: { container: HTMLElement }) => container);
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter({ name: 'plain', mount, unmount });
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				reinject,
				timeout
			})
		]);
		const panel = core.command('panel');
		controls.push(panel);
		const container = mount.mock.results[0].value as HTMLElement;
		return { core, panel, host, parent, container, mount, unmount };
	}

	it('cleans the old mount before reinjecting into a replacement target', async () => {
		const { core, panel, host, container, mount, unmount } = mountInjection(true);
		const replacement = host.cloneNode() as HTMLElement;
		unmount.mockImplementation(() => {
			expect(mount).toHaveBeenCalledOnce();
			expect(container.parentElement).toBe(host);
		});
		host.replaceWith(replacement);
		await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2), { interval: 1 });
		expect(unmount).toHaveBeenCalledExactlyOnceWith(container);
		expect(mount).toHaveBeenCalledTimes(2);
		expect(mount.mock.results[1].value.parentElement).toBe(replacement);
		expect(core.status('panel').getSnapshot()).toBe('mounted');
		unmount.mockReset();
	});

	it('can stop reinjection from a waiting state notification before mounting again', async () => {
		const { core, panel, host, mount, unmount } = mountInjection(true);
		const status = core.status('panel');
		const unsubscribe = status.subscribe(() => {
			if (status.getSnapshot() !== 'waiting') return;
			unsubscribe();
			void panel.stop();
		});
		host.replaceWith(host.cloneNode());
		await vi.waitFor(() => expect(unmount).toHaveBeenCalledOnce(), { interval: 1 });
		await vi.advanceTimersByTimeAsync(0);
		expect(status.getSnapshot()).toBe('idle');
		expect(mount).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps the mount through same-delivery moves, selector changes, and content updates', async () => {
		const { core, panel, host, parent, container, mount, unmount } = mountInjection(true);
		const snapshot = core.status('panel').getSnapshot();
		parent.remove();
		document.body.append(parent);
		container.remove();
		host.append(container);
		host.id = 'reused';
		host.className = 'changed';
		host.append(document.createTextNode('another item'));
		await Promise.resolve();
		expect(mount).toHaveBeenCalledOnce();
		expect(unmount).not.toHaveBeenCalled();
		expect(core.status('panel').getSnapshot()).toBe(snapshot);
	});

	it.each([
		undefined,
		50
	])('gives recovery a fresh budget %s and does not retry timeout', async (timeout) => {
		const { core, panel, host, mount } = mountInjection(true, timeout);
		const budget = timeout ?? 15000;
		vi.advanceTimersByTime(budget * 2);
		host.remove();
		await vi.advanceTimersByTimeAsync(0);
		expect(core.status('panel').getSnapshot()).toBe('waiting');
		vi.advanceTimersByTime(budget - 1);
		document.body.append(document.createElement('div'));
		await Promise.resolve();
		expect(core.status('panel').getSnapshot()).toBe('waiting');
		await vi.advanceTimersByTimeAsync(1);
		expect(core.status('panel').lastError?.code).toBe('MAKOO_DOM_WAIT_TIMEOUT');
		document.body.append(host);
		await Promise.resolve();
		expect(mount).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		panel.start();
		expect(mount).toHaveBeenCalledTimes(2);
	});

	it.each([
		'stop',
		'remove'
	] as const)('lets %s override recovery during its waiting notification', async (operation) => {
		const { core, panel, host, mount } = mountInjection(true);
		const status = core.status('panel');
		status.subscribe(() => {
			if (status.getSnapshot() === 'waiting') void panel[operation]();
		});
		host.replaceWith(host.cloneNode());
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('idle'), {
			interval: 1
		});
		expect(mount).toHaveBeenCalledOnce();
		expect(status.getSnapshot()).toBe('idle');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('blocks recovery after cleanup failure while still removing the container', async () => {
		const { core, panel, host, container, mount, unmount } = mountInjection(true);
		unmount.mockImplementation(() => {
			throw new Error('unmount failed');
		});
		host.replaceWith(host.cloneNode());
		await vi.waitFor(() => expect(core.status('panel').getSnapshot()).toBe('failed'), {
			interval: 1
		});
		expect(container.isConnected).toBe(false);
		expect(core.status('panel').lastError?.cleanupErrors[0]?.code).toBe(
			'MAKOO_ADAPTER_UNMOUNT_FAIL'
		);
		expect(mount).toHaveBeenCalledOnce();
		expect(() => panel.start()).toThrow(/cannot restart/);
		await expect(panel.stop()).rejects.toMatchObject({ code: 'MAKOO_ADAPTER_UNMOUNT_FAIL' });
	});

	it('rejects a container moved outside its target during mount before publishing mounted', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter({
			name: 'plain',
			mount({ container }) {
				document.body.append(container);
				return container;
			},
			unmount
		});
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.command('panel');
		controls.push(panel);
		await vi.waitFor(() => expect(core.status('panel').getSnapshot()).toBe('failed'), {
			interval: 1
		});
		expect(unmount).toHaveBeenCalledOnce();
		expect(core.status('panel').getSnapshot()).toBe('failed');
	});

	it('starts validity observation before invoking the adapter and cleans it up on stop', async () => {
		const observe = vi.spyOn(MutationObserver.prototype, 'observe');
		const { panel, host, mount, unmount } = mountInjection(true);
		// Finding an existing target ends discovery; validity tracking registers separately.
		expect(observe).toHaveBeenCalledTimes(2);
		await panel.stop();
		host.replaceWith(host.cloneNode());
		await Promise.resolve();
		expect(mount).toHaveBeenCalledOnce();
		expect(unmount).toHaveBeenCalledOnce();
	});

	it.each([
		'target',
		'ancestor',
		'container',
		'outside'
	] as const)('cleans up a disconnected %s without reinjection', async (removedPart) => {
		const { core, panel, host, parent, container, mount, unmount } = mountInjection();
		if (removedPart === 'target') host.remove();
		if (removedPart === 'ancestor') parent.remove();
		if (removedPart === 'container') container.remove();
		if (removedPart === 'outside') document.body.append(container);
		await vi.waitFor(() => expect(core.status('panel').getSnapshot()).toBe('failed'), {
			interval: 1
		});
		expect(unmount).toHaveBeenCalledExactlyOnceWith(container);
		expect(container.isConnected).toBe(false);
		expect(core.status('panel').getSnapshot()).toBe('failed');
		expect(mount).toHaveBeenCalledOnce();
	});
});
