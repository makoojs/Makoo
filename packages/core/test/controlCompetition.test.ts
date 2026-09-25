import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterMountParams, ComponentAdapter } from '../src';
import { createMakoo, type FeatureControl, inject, listen, MakooError } from '../src';

describe('control races and cleanup failure', () => {
	const handles: FeatureControl[] = [];
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
		mount: ComponentAdapter['mount'],
		unmount: ComponentAdapter['unmount'] = () => {}
	): ComponentAdapter {
		return { name: 'plain', mount, unmount };
	}

	function hostElement() {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		return host;
	}

	it.each([
		false,
		true
	])('locks an adapter mount cleanup failure, with container cleanup failure=%s', async (failContainerCleanup) => {
		const host = hostElement();
		const frameworkCleanup = new MakooError('framework cleanup failed');
		const mountError = new MakooError('mount failed').withCleanupErrors([frameworkCleanup]);
		const containerError = new Error('container cleanup failed');
		const unmount = vi.fn();
		const mount = vi.fn(({ container }: AdapterMountParams) => {
			if (failContainerCleanup) {
				vi.spyOn(container, 'remove').mockImplementation(() => {
					throw containerError;
				});
			}
			throw mountError;
		});
		const core = createMakoo();
		core.useAdapter(adapter(mount, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		const diagnostic = panel.lastError;
		expect(diagnostic?.cause).toBe(mountError);
		expect(diagnostic?.cleanupErrors[0]).toBe(frameworkCleanup);
		expect(diagnostic?.cleanupErrors).toHaveLength(failContainerCleanup ? 2 : 1);
		if (failContainerCleanup) expect(diagnostic?.cleanupErrors[1]?.cause).toBe(containerError);
		expect(() => panel.start()).toThrow(/cannot restart after cleanup failed/);
		expect(panel.lastError).toBe(diagnostic);
		const completion = panel.stop();
		expect(panel.remove()).toBe(completion);
		await expect(completion).rejects.toBe(frameworkCleanup);
		expect(core.get('panel')).toBe(panel);
		expect(() =>
			core.apply([listen({ name: 'panel', listenAt: '#host', type: 'click', callback() {} })])
		).toThrow();
		expect(mount).toHaveBeenCalledOnce();
		expect(unmount).not.toHaveBeenCalled();
		expect(host.children.length).toBe(failContainerCleanup ? 1 : 0);
	});

	it.each([
		'idle',
		'failed'
	])('settles a mount stop before a %s subscriber starts another execution', async (restartStatus) => {
		let stopped: Promise<void> | undefined;
		let mounts = 0;
		const core = createMakoo();
		core.useAdapter(
			adapter(({ injection }) => {
				mounts += 1;
				if (mounts === 1) {
					stopped = injection.stop();
					if (restartStatus === 'failed') throw new Error('mount failed after stop');
				}
				return mounts;
			})
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		const unsubscribe = panel.state.subscribe(() => {
			if (panel.state.getSnapshot().status === restartStatus) {
				unsubscribe();
				panel.start();
			}
		});
		hostElement();
		await Promise.resolve();
		expect(stopped).toBeDefined();
		let settled = false;
		void stopped?.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(true);
		expect(mounts).toBe(2);
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(panel.lastError).toBeUndefined();
	});

	it('keeps a stopped mount unfinished until mount returns, then cleans up that handle once', () => {
		const host = hostElement();
		const events: string[] = [];
		let statusDuringMount = '';
		let containerDuringMount = false;
		const core = createMakoo();
		core.useAdapter(
			adapter(
				({ container, injection }: AdapterMountParams) => {
					events.push('mount');
					const first = injection.stop();
					const second = injection.stop();
					expect(first).toBe(second);
					statusDuringMount = injection.state.getSnapshot().status;
					containerDuringMount = container.isConnected;
					events.push('mount-return');
					return 'handle';
				},
				(handle) => {
					events.push(`unmount:${String(handle)}`);
				}
			)
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		expect(statusDuringMount).not.toBe('idle');
		expect(containerDuringMount).toBe(true);
		expect(events).toEqual(['mount', 'mount-return', 'unmount:handle']);
		expect(host.querySelector('div')).toBeNull();
		expect(panel.state.getSnapshot().status).toBe('idle');
	});

	it.each([
		'injection',
		'listener'
	])('shares the completed %s stop with an idle subscriber before restart', async (kind) => {
		hostElement();
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle'));
		core.apply([
			kind === 'injection'
				? inject({ name: 'feature', injectAt: '#host', adapter: 'plain', component: {} })
				: listen({ name: 'feature', listenAt: '#host', type: 'click', callback() {} })
		]);
		const feature = core.get('feature');
		handles.push(feature);
		let repeated: Promise<void> | undefined;
		const unsubscribe = feature.state.subscribe(() => {
			if (feature.state.getSnapshot().status === 'idle') {
				unsubscribe();
				repeated = feature.stop();
				feature.start();
			}
		});
		const completion = feature.stop();
		expect(repeated).toBe(completion);
		await completion;
		expect(feature.state.getSnapshot().status).toBe(kind === 'injection' ? 'mounted' : 'bound');
	});

	it('starts one later execution after stop then start, and stays stopped after stop then start then stop', () => {
		const host = hostElement();
		const mounts: string[] = [];
		let mode: 'restart' | 'cancel' = 'restart';
		const core = createMakoo();
		core.useAdapter(
			adapter(({ injection }) => {
				mounts.push(mode);
				if (mounts.length === 1) {
					injection.stop();
					injection.start();
					if (mode === 'cancel') injection.stop();
				}
				return mounts.length;
			})
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		expect(mounts).toEqual(['restart', 'restart']);
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(host.querySelectorAll('div')).toHaveLength(1);
		mode = 'cancel';
		mounts.length = 0;
		panel.stop();
		panel.start();
		expect(mounts).toEqual(['cancel']);
		expect(panel.state.getSnapshot().status).toBe('idle');
	});

	it('drops a queued start when remove wins during mount', () => {
		hostElement();
		const core = createMakoo();
		const mount = vi.fn(({ injection }: AdapterMountParams) => {
			injection.stop();
			injection.start();
			injection.remove();
			return 'handle';
		});
		core.useAdapter(adapter(mount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		expect(mount).toHaveBeenCalledOnce();
		expect(() => core.get('panel')).toThrow();
	});

	it('keeps only the latest intent issued while unmount is running', async () => {
		hostElement();
		let mounts = 0;
		let mode: 'restart' | 'cancel' | 'remove' = 'restart';
		const core = createMakoo();
		core.useAdapter(
			adapter(
				() => {
					mounts += 1;
					return mounts;
				},
				() => {
					const panel = core.get('panel');
					if (mode === 'remove') {
						void panel.remove();
						return;
					}
					panel.start();
					if (mode === 'cancel') panel.stop();
				}
			)
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		await panel.stop();
		expect(mounts).toBe(2);
		expect(panel.state.getSnapshot().status).toBe('mounted');
		mode = 'cancel';
		await panel.stop();
		expect(mounts).toBe(2);
		expect(panel.state.getSnapshot().status).toBe('idle');
		panel.start();
		expect(mounts).toBe(3);
		expect(panel.state.getSnapshot().status).toBe('mounted');
		mode = 'remove';
		await panel.remove();
		expect(mounts).toBe(3);
		expect(() => core.get('panel')).toThrow();
	});

	it('still removes the container when unmount throws, and repeats the same failure', async () => {
		const host = hostElement();
		const core = createMakoo();
		const mount = vi.fn(() => 'handle');
		const unmount = vi.fn(() => {
			core.get('panel').start();
			throw new Error('unmount failed');
		});
		core.useAdapter(adapter(mount, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		const container = host.querySelector('div');
		const first = panel.stop();
		const second = panel.stop();
		expect(second).toBe(first);
		await expect(first).rejects.toMatchObject({ code: 'MAKOO_ADAPTER_UNMOUNT_FAIL' });
		expect(unmount).toHaveBeenCalledOnce();
		expect(mount).toHaveBeenCalledOnce();
		expect(container?.isConnected).toBe(false);
		expect(panel.state.getSnapshot().status).toBe('failed');
		await expect(panel.remove()).rejects.toBe(await first.catch((error: unknown) => error));
		expect(unmount).toHaveBeenCalledOnce();
		expect(panel.lastError?.code).toBe('MAKOO_ADAPTER_UNMOUNT_FAIL');
		expect(() =>
			core.apply([listen({ name: 'panel', listenAt: '#host', type: 'click', callback() {} })])
		).toThrow();
		expect(() => core.get('panel')).not.toThrow();
	});

	it('preserves the mount error when a later cleanup step fails', () => {
		const host = hostElement();
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(
			adapter(({ container }) => {
				vi.spyOn(container, 'remove').mockImplementation(() => {
					throw new Error('remove failed');
				});
				throw new Error('mount failed');
			}, unmount)
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		expect(unmount).not.toHaveBeenCalled();
		expect(host.querySelector('div')?.isConnected).toBe(true);
		expect(panel.lastError?.code).toBe('MAKOO_ADAPTER_MOUNT_FAIL');
		expect(panel.lastError?.cause).toMatchObject({ message: 'mount failed' });
		expect(panel.lastError?.cleanupErrors[0]).toMatchObject({
			code: 'MAKOO_INJECTION_CONTAINER_REMOVE_FAIL'
		});
		expect(panel.lastError?.cleanupErrors[0]?.cause).toMatchObject({
			message: 'remove failed'
		});
		expect(console.error).toHaveBeenCalledWith(panel.lastError);
		const diagnostic = panel.lastError;
		expect(() => panel.start()).toThrow(/cannot restart after cleanup failed/);
		expect(panel.lastError).toBe(diagnostic);
		expect(panel.state.getSnapshot().status).toBe('failed');
	});

	it('allows an explicit restart after an ordinary mount failure whose cleanup succeeded', () => {
		hostElement();
		let fail = true;
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(
			adapter(() => {
				if (fail) throw new Error('mount failed');
				return 'handle';
			}, unmount)
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.get('panel');
		handles.push(panel);
		expect(panel.state.getSnapshot().status).toBe('failed');
		expect(panel.lastError?.code).toBe('MAKOO_ADAPTER_MOUNT_FAIL');
		expect(panel.lastError?.cleanupErrors).toEqual([]);
		expect(unmount).not.toHaveBeenCalled();
		fail = false;
		panel.start();
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(panel.lastError).toBeUndefined();
	});

	it('leaves other features running when one injection cleanup fails', async () => {
		const button = document.createElement('button');
		button.className = 'play';
		document.body.append(button, hostElement());
		const callback = vi.fn();
		const core = createMakoo();
		core.useAdapter(
			adapter(
				() => 'handle',
				() => {
					throw new Error('unmount failed');
				}
			)
		);
		core.apply([
			listen({ name: 'play', listenAt: '.play', type: 'click', callback }),
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })
		]);
		handles.push(core.get('play'), core.get('panel'));
		await expect(core.get('panel').stop()).rejects.toMatchObject({
			code: 'MAKOO_ADAPTER_UNMOUNT_FAIL'
		});
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(core.get('play').state.getSnapshot().status).toBe('bound');
	});

	it('keeps a removed injection from affecting a same-name replacement', async () => {
		const host = hostElement();
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle'));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const previous = core.get('panel');
		const previousState = previous.state;
		const seen: string[] = [];
		previousState.subscribe(() => seen.push(previousState.getSnapshot().status));
		previous.remove();
		seen.length = 0;
		expect(() => core.get('panel')).toThrow();
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const replacement = core.get('panel');
		handles.push(replacement);
		expect(replacement).not.toBe(previous);
		expect(replacement.state).not.toBe(previousState);
		await replacement.stop();
		expect(seen).toEqual([]);
		expect(replacement.state.getSnapshot().status).toBe('idle');
		expect(() => previous.start()).toThrow(/was removed/);
		await previous.remove();
		await previous.stop();
		expect(core.get('panel')).toBe(replacement);
		expect(host.querySelector('div')).toBeNull();
	});

	it('shares listener cleanup and restarts only when the latest intent says to', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const callback = vi.fn();
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const play = core.get('play');
		handles.push(play);
		let mode: 'restart' | 'cancel' = 'cancel';
		let handled = false;
		const unbind = vi.spyOn(button, 'removeEventListener').mockImplementation(function (
			this: Element,
			type,
			listener,
			options
		) {
			if (!handled) {
				handled = true;
				play.start();
				if (mode === 'cancel') play.stop();
			}
			return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
		});
		const first = play.stop();
		const second = play.stop();
		expect(second).toBe(first);
		await first;
		expect(play.state.getSnapshot().status).toBe('idle');
		button.click();
		expect(callback).not.toHaveBeenCalled();
		const callsAfterStop = unbind.mock.calls.length;
		await play.stop();
		expect(unbind.mock.calls.length).toBe(callsAfterStop);
		handled = false;
		mode = 'restart';
		play.start();
		await play.stop();
		expect(play.state.getSnapshot().status).toBe('bound');
		button.click();
		expect(callback).toHaveBeenCalledOnce();
	});

	it('keeps the original listener failure when unbind fails and does not recover', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const core = createMakoo();
		core.apply([
			listen({
				name: 'play',
				listenAt: '.host',
				type: 'click',
				callback() {},
				reinject: true
			})
		]);
		const play = core.get('play');
		handles.push(play);
		const add = vi.spyOn(button, 'addEventListener');
		vi.spyOn(button, 'removeEventListener').mockImplementation(() => {
			play.start();
			throw new Error('unbind failed');
		});
		button.remove();
		await Promise.resolve();
		expect(play.state.getSnapshot().status).toBe('failed');
		expect(play.lastError?.code).toBe('MAKOO_LISTENER_TARGET_DETACHED');
		expect(play.lastError?.cleanupErrors[0]?.code).toBe('MAKOO_LISTENER_UNBIND_FAIL');
		expect(console.error).toHaveBeenCalledWith(play.lastError);
		expect(add).not.toHaveBeenCalled();
		const diagnostic = play.lastError;
		expect(() => play.start()).toThrow(/cannot restart after cleanup failed/);
		expect(play.lastError).toBe(diagnostic);
		const first = play.stop();
		expect(play.remove()).toBe(first);
		await expect(first).rejects.toMatchObject({ code: 'MAKOO_LISTENER_UNBIND_FAIL' });
		expect(() => core.get('play')).not.toThrow();
	});

	it('keeps a removed listener from affecting a same-name replacement', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const previous = core.get('play');
		const previousState = previous.state;
		const seen: string[] = [];
		previousState.subscribe(() => seen.push(previousState.getSnapshot().status));
		previous.remove();
		seen.length = 0;
		expect(() => core.get('play')).toThrow();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const replacement = core.get('play');
		handles.push(replacement);
		await replacement.stop();
		expect(seen).toEqual([]);
		expect(() => previous.start()).toThrow(/was removed/);
		await previous.remove();
		expect(core.get('play')).toBe(replacement);
	});
});
