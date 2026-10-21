import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterMountParams, MountAdapter } from '../src';
import { createMakoo, type InjectionCommand, inject, listen, MakooErrorCode } from '../src';

describe('single component injection', () => {
	const handles: InjectionCommand[] = [];
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
		const panel = core.injection('panel').command;
		handles.push(panel);
		Object.assign(declaration, { component: { id: 'other' }, props: { title: 'changed' } });
		props.nested.n = 2;

		expect(params?.component).toBe(component);
		expect(params?.props).toBe(props);
		expect(params?.injection).toBe(core.injection('panel'));
		expect(params?.injection.command).toBe(panel);
		expect(params?.injection.statusHandle).toBe(core.injection('panel').statusHandle);
		expect(Object.keys(params?.injection.command ?? {}).sort()).toEqual([
			'name',
			'remove',
			'start',
			'stop'
		]);
		expect(Object.keys(params?.injection.statusHandle ?? {}).sort()).toEqual([
			'attachedListener',
			'attachedListenerNames',
			'getSnapshot',
			'lastError',
			'subscribe'
		]);
		expect(params?.injection.statusHandle.attachedListenerNames).toEqual([]);
		expect(params?.container.parentElement).toBe(host);
		expect(extra.querySelector('div')).toBeNull();
		expect(host.firstChild?.textContent).toBe('keep');
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
		expect(Object.isFrozen(props)).toBe(false);
		expect(Object.isFrozen(props.nested)).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('looks up a standalone listener from the component mount and rejects anything else', async () => {
		document.body.innerHTML = '<section id="host"></section>';
		let params: AdapterMountParams | undefined;
		const core = createMakoo();
		core.useAdapter(
			adapter((input) => {
				params = input;
				return { mounted: true };
			})
		);
		const save = listen({ name: 'save', listenAt: '#host', type: 'click', callback() {} });
		core.apply([
			save,
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [
					listen({ name: 'play', listenAt: '#missing', type: 'click', callback() {} })
				]
			})
		]);
		handles.push(core.injection('panel').command, core.listener('save').command);
		expect(() => core.injection('save')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(() => core.listener('panel')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		const found = params?.listener('save');
		expect(found).toBe(core.listener('save'));
		expect(found?.command).toBe(core.listener('save').command);
		expect(found?.statusHandle).toBe(core.listener('save').statusHandle);
		for (const name of ['panel', 'play', 'missing']) {
			expect(() => params?.listener(name)).toThrow(
				expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
			);
		}

		await found?.command.remove();
		core.apply([save]);
		handles.push(core.listener('save').command);
		const replacement = params?.listener('save');
		expect(replacement).toBe(core.listener('save'));
		expect(replacement?.command).toBe(core.listener('save').command);
		expect(replacement?.statusHandle).toBe(core.listener('save').statusHandle);
		expect(replacement).not.toBe(found);
		expect(replacement?.command).not.toBe(found?.command);
		expect(replacement?.statusHandle).not.toBe(found?.statusHandle);
	});

	it.each([0, false, null, undefined])('unmounts a falsy handle %s', async (handle) => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(() => handle, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		handles.push(panel);
		const container = host.querySelector('div');
		await panel.stop();
		expect(unmount).toHaveBeenCalledWith(handle);
		expect(container?.isConnected).toBe(false);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('idle');
	});

	it('unregisters a stopped component as soon as it is removed and settles later controls with that removal', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle'));
		const declaration = inject({
			name: 'panel',
			injectAt: '#host',
			adapter: 'plain',
			component: {}
		});
		core.apply([declaration]);
		const panel = core.injection('panel').command;
		await panel.stop();
		const removal = panel.remove();
		expect(() => core.injection('panel').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(panel.stop()).toBe(removal);
		expect(panel.remove()).toBe(removal);
		await removal;
		core.apply([declaration]);
		handles.push(core.injection('panel').command);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
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
		const panel = core.injection('panel').command;
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
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
		await panel.remove();
		expect(containers[1]?.isConnected).toBe(false);
		expect(() => core.injection('panel').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(() => panel.start()).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_REMOVED })
		);
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
		const panel = core.injection('panel').command;
		handles.push(panel);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('waiting');
		expect(mount).not.toHaveBeenCalled();
		const budget = timeout ?? 15000;
		vi.advanceTimersByTime(budget - 1);
		document.body.append(document.createElement('div'));
		await Promise.resolve();
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('waiting');
		await vi.advanceTimersByTimeAsync(1);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed');
		expect(core.injection('panel').statusHandle.lastError).toMatchObject({
			code: 'MAKOO_TARGET_WAIT_TIMEOUT',
			message: expect.stringContaining('panel')
		});
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		await Promise.resolve();
		expect(mount).not.toHaveBeenCalled();
		panel.start();
		expect(mount).toHaveBeenCalledOnce();
		expect(core.injection('panel').statusHandle.lastError).toBeUndefined();
		expect(host.querySelector('div')).toBeInstanceOf(HTMLElement);
	});

	it('does not mount after stop while the target is still pending', async () => {
		const core = createMakoo();
		const mount = vi.fn(() => 'handle');
		core.useAdapter(adapter(mount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		handles.push(panel);
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const completion = panel.stop();
		await Promise.resolve();
		await completion;
		expect(mount).not.toHaveBeenCalled();
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('idle');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not mount when a waiting subscriber stops the injection', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const mount = vi.fn(() => 'handle');
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(mount, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		const status = core.injection('panel').statusHandle;
		handles.push(panel);
		await panel.stop();
		mount.mockClear();
		unmount.mockClear();
		const unsubscribe = status.subscribe(() => {
			if (status.getSnapshot() === 'waiting') void panel.stop();
		});
		panel.start();
		unsubscribe();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('idle'), { interval: 1 });
		expect(mount).not.toHaveBeenCalled();
		expect(unmount).not.toHaveBeenCalled();
		expect(host.children).toHaveLength(0);
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
		const panel = core.injection('panel').command;
		const status = core.injection('panel').statusHandle;
		handles.push(panel);
		await panel.stop();
		mount.mockClear();
		unmount.mockClear();
		const unsubscribe = status.subscribe(() => {
			if (status.getSnapshot() === 'waiting') host.remove();
		});
		panel.start();
		unsubscribe();
		expect(mount).not.toHaveBeenCalled();
		expect(unmount).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('failed'), {
			interval: 1
		});
		expect(host.children).toHaveLength(0);
		expect(status.getSnapshot()).toBe('failed');
		expect(core.injection('panel').statusHandle.lastError?.code).toBe(
			'MAKOO_MOUNT_TARGET_DETACHED'
		);
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
		let removed: InjectionCommand | undefined;
		const core = createMakoo();
		core.useAdapter(
			adapter(() => {
				removed = core.listener('second').command;
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
					const replacement = core.listener('second').command;
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
		handles.push(core.injection('first').command, core.listener('third').command);
		expect(() => removed?.start()).toThrow(/was removed/);
		expect(core.listener('third').statusHandle.getSnapshot()).toBe('bound');
		if (replace) {
			expect(core.listener('second').command).not.toBe(removed);
			expect(core.listener('second').statusHandle.getSnapshot()).toBe('idle');
		} else {
			expect(() => core.listener('second').command).toThrow(
				expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
			);
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
		).toThrow(
			expect.objectContaining({
				code: MakooErrorCode.ADAPTER_NOT_FOUND,
				message: expect.stringContaining('missing')
			})
		);
		host.click();
		expect(callback).not.toHaveBeenCalled();
		expect(mount).not.toHaveBeenCalled();
		expect(() => core.listener('play').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(() => core.injection('panel').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects a duplicate adapter name and keeps the original', () => {
		const core = createMakoo();
		const first = vi.fn(() => 'first');
		const second = vi.fn(() => 'second');
		core.useAdapter(adapter(first));
		expect(() => core.useAdapter(adapter(second))).toThrow(
			expect.objectContaining({
				code: MakooErrorCode.ADAPTER_NAME_CONFLICT,
				message: expect.stringContaining('plain')
			})
		);
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		handles.push(core.injection('panel').command);
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
		handles.push(core.listener('play').command, core.injection('panel').command);
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		await vi.waitFor(
			() => expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed'),
			{
				interval: 1
			}
		);
		expect(core.injection('panel').statusHandle.lastError).toMatchObject({
			code: MakooErrorCode.MOUNT_FAILED,
			cause: expect.objectContaining({ message: 'mount failed' })
		});
		expect(console.error).toHaveBeenCalledWith(core.injection('panel').statusHandle.lastError);
		expect(host.querySelector('div')).toBeNull();
		expect(() =>
			core.apply([listen({ name: 'panel', listenAt: '.play', type: 'click', callback() {} })])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed');
	});

	it('reports a state subscriber failure without hiding the injection failure', async () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		const subscriberError = new Error('subscriber failed');
		const seen: string[] = [];
		const core = createMakoo();
		core.useAdapter(
			adapter(
				() => 'handle',
				() => {
					throw new Error('unmount failed');
				}
			)
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		handles.push(panel);
		const status = core.injection('panel').statusHandle;
		status.subscribe(() => {
			throw subscriberError;
		});
		status.subscribe(() => {
			seen.push(status.getSnapshot());
		});
		host.replaceWith(host.cloneNode());
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('failed'), { interval: 1 });
		expect(status.lastError?.code).toBe(MakooErrorCode.INJECTION_CLEANUP_FAILED);
		expect(seen).toContain('failed');
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({
				code: MakooErrorCode.STATE_SUBSCRIBER_FAILED,
				cause: subscriberError,
				message: expect.stringContaining('"panel"')
			})
		);
	});
});
