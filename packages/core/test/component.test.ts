import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterMountParams, MountAdapter } from '../src';
import { createMakoo, type InjectionControl, inject, listen } from '../src';

describe('single component injection', () => {
	const handles: InjectionControl[] = [];
	beforeEach(() => {
		document.body.replaceChildren();
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(async () => {
		for (const handle of handles.splice(0)) await handle.remove().catch(() => {});
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	function adapter(
		mount: MountAdapter['mount'],
		unmount: MountAdapter['unmount'] = () => {}
	): MountAdapter {
		return { name: 'plain', mount, unmount };
	}

	it('mounts into the first existing target and keeps props mutable', () => {
		const host = document.createElement('section');
		host.id = 'host';
		host.append(document.createTextNode('keep'));
		const extra = document.createElement('section');
		extra.id = 'host';
		document.body.append(host, extra);
		const component = { id: 'panel' };
		const props = { title: 'Hello', nested: { n: 1 } };
		let params: AdapterMountParams | undefined;
		const core = createMakoo();
		core.useAdapter(
			adapter((input) => {
				params = input;
				return { mounted: true };
			})
		);
		const declaration = inject({
			name: 'panel',
			injectAt: '#host',
			adapter: 'plain',
			component,
			props
		});
		core.apply([declaration]);
		const panel = core.get('panel');
		handles.push(panel);
		Object.assign(declaration, { component: { id: 'other' }, props: { title: 'changed' } });
		props.nested.n = 2;

		expect(params?.component).toBe(component);
		expect(params?.props).toBe(props);
		expect(params?.control).toBe(panel);
		expect(Object.keys(params?.control ?? {}).sort()).toEqual([
			'lastError',
			'listenerState',
			'name',
			'remove',
			'start',
			'state',
			'stop'
		]);
		expect(params?.container.parentElement).toBe(host);
		expect(extra.querySelector('div')).toBeNull();
		expect(host.firstChild?.textContent).toBe('keep');
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(Object.isFrozen(props)).toBe(false);
		expect(Object.isFrozen(props.nested)).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([0, false, null, undefined])('unmounts a falsy handle %s', async (handle) => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(() => handle, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		const container = host.querySelector('div');
		await panel.stop();
		expect(unmount).toHaveBeenCalledWith(handle);
		expect(container?.isConnected).toBe(false);
		expect(panel.state.getSnapshot().status).toBe('idle');
	});

	it('unmounts synchronously before removing the container, then starts a new execution', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const containers: HTMLElement[] = [];
		const events: string[] = [];
		const core = createMakoo();
		core.useAdapter(
			adapter(
				({ container }) => {
					containers.push(container);
					events.push('mount');
					return containers.length;
				},
				(handle) => {
					events.push(`unmount:${handle}`);
					expect(containers.at(-1)?.isConnected).toBe(true);
				}
			)
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		panel.start();
		expect(containers).toHaveLength(1);
		await panel.stop();
		expect(events).toEqual(['mount', 'unmount:1']);
		expect(containers[0]?.isConnected).toBe(false);
		panel.start();
		expect(containers).toHaveLength(2);
		expect(containers[0]).not.toBe(containers[1]);
		expect(containers[1]?.parentElement).toBe(host);
		expect(panel.state.getSnapshot().status).toBe('mounted');
		await panel.remove();
		expect(containers[1]?.isConnected).toBe(false);
		expect(() => core.get('panel')).toThrow();
		expect(() => panel.start()).toThrow();
	});

	it.each([
		undefined,
		50
	])('waits for a later target and times out once with budget %s', async (timeout) => {
		const core = createMakoo();
		const mount = vi.fn(() => 'handle');
		core.useAdapter(adapter(mount));
		core.apply([
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {}, timeout })
		]);
		const panel = core.get('panel');
		handles.push(panel);
		expect(panel.state.getSnapshot().status).toBe('waiting');
		expect(mount).not.toHaveBeenCalled();
		const budget = timeout ?? 15000;
		vi.advanceTimersByTime(budget - 1);
		document.body.append(document.createElement('div'));
		await Promise.resolve();
		expect(panel.state.getSnapshot().status).toBe('waiting');
		await vi.advanceTimersByTimeAsync(1);
		expect(panel.state.getSnapshot().status).toBe('failed');
		expect(panel.lastError).toMatchObject({
			code: 'MAKOO_DOM_WAIT_TIMEOUT',
			context: { injection: 'panel', phase: 'wait', reason: 'timeout' }
		});
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		await Promise.resolve();
		expect(mount).not.toHaveBeenCalled();
		panel.start();
		expect(mount).toHaveBeenCalledOnce();
		expect(panel.lastError).toBeUndefined();
		expect(host.querySelector('div')).toBeInstanceOf(HTMLElement);
	});

	it('does not mount after stop while the target is still pending', async () => {
		const core = createMakoo();
		const mount = vi.fn(() => 'handle');
		core.useAdapter(adapter(mount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const completion = panel.stop();
		await Promise.resolve();
		await completion;
		expect(mount).not.toHaveBeenCalled();
		expect(panel.state.getSnapshot().status).toBe('idle');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not mount a target that disconnects before use', async () => {
		const host = document.createElement('section');
		vi.spyOn(document, 'querySelector').mockReturnValueOnce(host);
		vi.spyOn(host, 'isConnected', 'get').mockReturnValueOnce(true).mockReturnValue(false);
		const mount = vi.fn(() => 'handle');
		const core = createMakoo();
		core.useAdapter(adapter(mount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		expect(mount).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('failed'), {
			interval: 1
		});
		expect(panel.lastError?.code).toBe('MAKOO_COMPONENT_TARGET_DETACHED');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not mount when a waiting subscriber disconnects the selected target', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const mount = vi.fn(() => 'handle');
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(mount, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		await panel.stop();
		mount.mockClear();
		unmount.mockClear();
		const unsubscribe = panel.state.subscribe(() => {
			if (panel.state.getSnapshot().status === 'waiting') host.remove();
		});
		panel.start();
		unsubscribe();
		expect(mount).not.toHaveBeenCalled();
		expect(unmount).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('failed'), {
			interval: 1
		});
		expect(host.children).toHaveLength(0);
		expect(panel.state.getSnapshot().status).toBe('failed');
		expect(panel.lastError?.code).toBe('MAKOO_COMPONENT_TARGET_DETACHED');
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([
		false,
		true
	])('continues a batch after an earlier mount removes a later feature, replacement=%s', (replace) => {
		const host = document.createElement('button');
		host.id = 'host';
		document.body.append(host);
		const removedCallback = vi.fn();
		const replacementCallback = vi.fn();
		const thirdCallback = vi.fn();
		let removed: InjectionControl | undefined;
		const core = createMakoo();
		core.useAdapter(
			adapter(() => {
				removed = core.get('second');
				void removed.remove();
				if (replace) {
					core.apply([
						listen({
							name: 'second',
							listenAt: '#host',
							type: 'click',
							callback: replacementCallback
						})
					]);
					const replacement = core.get('second');
					handles.push(replacement);
					void replacement.stop();
				}
				return 'handle';
			})
		);
		expect(() =>
			core.apply([
				inject({ name: 'first', injectAt: '#host', adapter: 'plain', component: {} }),
				listen({
					name: 'second',
					listenAt: '#host',
					type: 'click',
					callback: removedCallback
				}),
				listen({ name: 'third', listenAt: '#host', type: 'click', callback: thirdCallback })
			])
		).not.toThrow();
		handles.push(core.get('first'), core.get('third'));
		expect(() => removed?.start()).toThrow(/was removed/);
		expect(core.get('third').state.getSnapshot().status).toBe('bound');
		if (replace) {
			expect(core.get('second')).not.toBe(removed);
			expect(core.get('second').state.getSnapshot().status).toBe('idle');
		} else {
			expect(() => core.get('second')).toThrow();
		}
		host.click();
		expect(removedCallback).not.toHaveBeenCalled();
		expect(replacementCallback).not.toHaveBeenCalled();
		expect(thirdCallback).toHaveBeenCalledOnce();
	});

	it('rejects an unknown adapter before starting anything else in the batch', () => {
		const host = document.createElement('button');
		host.className = 'play';
		document.body.append(host);
		const callback = vi.fn();
		const mount = vi.fn(() => 'handle');
		const core = createMakoo();
		core.useAdapter(adapter(mount));
		expect(() =>
			core.apply([
				listen({ name: 'play', listenAt: '.play', type: 'click', callback }),
				inject({ name: 'panel', injectAt: '#host', adapter: 'missing', component: {} })
			])
		).toThrow();
		host.click();
		expect(callback).not.toHaveBeenCalled();
		expect(mount).not.toHaveBeenCalled();
		expect(() => core.get('play')).toThrow();
		expect(() => core.get('panel')).toThrow();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects a duplicate adapter name and keeps the original', () => {
		const core = createMakoo();
		const first = vi.fn(() => 'first');
		const second = vi.fn(() => 'second');
		core.useAdapter(adapter(first));
		expect(() => core.useAdapter(adapter(second))).toThrow();
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		handles.push(core.get('panel'));
		expect(first).toHaveBeenCalledOnce();
		expect(second).not.toHaveBeenCalled();
	});

	it('shares the feature namespace and leaves a mount failure inside its own feature', async () => {
		const button = document.createElement('button');
		button.className = 'play';
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(button, host);
		const callback = vi.fn();
		const core = createMakoo();
		core.useAdapter(
			adapter(() => {
				throw new Error('mount failed');
			})
		);
		core.apply([
			listen({ name: 'play', listenAt: '.play', type: 'click', callback }),
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })
		]);
		handles.push(core.get('play'), core.get('panel'));
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		await vi.waitFor(
			() => expect(core.get('panel').state.getSnapshot().status).toBe('failed'),
			{ interval: 1 }
		);
		expect(core.get('panel').lastError?.code).toBe('MAKOO_ADAPTER_MOUNT_FAIL');
		expect(host.querySelector('div')).toBeNull();
		expect(() =>
			core.apply([listen({ name: 'panel', listenAt: '.play', type: 'click', callback() {} })])
		).toThrow();
		expect(core.get('panel').state.getSnapshot().status).toBe('failed');
	});
});
