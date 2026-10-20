import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterMountParams, MountAdapter } from '../src';
import {
	createMakoo,
	type InjectionCommand,
	inject,
	listen,
	MakooAggregateError,
	MakooErrorCode
} from '../src';

describe('control races and cleanup failure', () => {
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
		const frameworkCleanup = new Error('framework cleanup failed');
		const mountCause = new Error('mount failed');
		const mountError = new MakooAggregateError([frameworkCleanup], 'adapter cleanup failed', {
			code: MakooErrorCode.MOUNT_CLEANUP_FAILED,
			cause: mountCause
		});
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
		const panel = core.injection('panel').command;
		handles.push(panel);
		await vi.waitFor(
			() => expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed'),
			{
				interval: 1
			}
		);
		const diagnostic = core.injection('panel').statusHandle.lastError;
		expect(diagnostic).toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: expect.arrayContaining([
				expect.objectContaining({ code: MakooErrorCode.MOUNT_FAILED, cause: mountCause }),
				frameworkCleanup
			])
		});
		expect(diagnostic).toBeInstanceOf(MakooAggregateError);
		if (!(diagnostic instanceof MakooAggregateError)) throw diagnostic;
		expect(diagnostic.errors).toHaveLength(failContainerCleanup ? 3 : 2);
		if (failContainerCleanup)
			expect(diagnostic.errors[2]).toMatchObject({ cause: containerError });
		expect(() => panel.start()).toThrow(/cannot restart after cleanup failed/);
		expect(core.injection('panel').statusHandle.lastError).toBe(diagnostic);
		const completion = panel.stop();
		await Promise.all([
			expect(completion).rejects.toBe(diagnostic),
			expect(panel.remove()).rejects.toBe(diagnostic)
		]);
		expect(core.injection('panel').command).toBe(panel);
		expect(() =>
			core.apply([listen({ name: 'panel', listenAt: '#host', type: 'click', callback() {} })])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
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
					stopped = injection.command.stop();
					if (restartStatus === 'failed') throw new Error('mount failed after stop');
				}
				return mounts;
			})
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		const status = core.injection('panel').statusHandle;
		handles.push(panel);
		const unsubscribe = status.subscribe(() => {
			if (status.getSnapshot() === restartStatus) {
				unsubscribe();
				panel.start();
			}
		});
		hostElement();
		await Promise.resolve();
		expect(stopped).toBeDefined();
		await stopped;
		expect(mounts).toBe(2);
		expect(status.getSnapshot()).toBe('mounted');
		expect(core.injection('panel').statusHandle.lastError).toBeUndefined();
	});

	it('keeps a stopped mount unfinished until mount returns, then cleans up that handle once', async () => {
		const host = hostElement();
		const events: string[] = [];
		let statusDuringMount = '';
		let containerDuringMount = false;
		const completions: Promise<void>[] = [];
		const core = createMakoo();
		core.useAdapter(
			adapter(
				({ container, injection }: AdapterMountParams) => {
					events.push('mount');
					const first = injection.command.stop();
					const second = injection.command.stop();
					completions.push(first, second);
					statusDuringMount = injection.statusHandle.getSnapshot();
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
		const panel = core.injection('panel').command;
		handles.push(panel);
		expect(statusDuringMount).not.toBe('idle');
		expect(containerDuringMount).toBe(true);
		await Promise.all(completions);
		expect(events).toEqual(['mount', 'mount-return', 'unmount:handle']);
		expect(host.querySelector('div')).toBeNull();
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('idle');
	});

	it.each([
		'component',
		'listener'
	])('shares the completed %s stop with an idle subscriber before restart', async (kind) => {
		hostElement();
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle'));
		core.apply([
			kind === 'component'
				? inject({ name: 'feature', injectAt: '#host', adapter: 'plain', component: {} })
				: listen({ name: 'feature', listenAt: '#host', type: 'click', callback() {} })
		]);
		const feature =
			kind === 'component'
				? core.injection('feature').command
				: core.listener('feature').command;
		const status =
			kind === 'component'
				? core.injection('feature').statusHandle
				: core.listener('feature').statusHandle;
		handles.push(feature);
		let repeated: Promise<void> | undefined;
		const unsubscribe = status.subscribe(() => {
			if (status.getSnapshot() === 'idle') {
				unsubscribe();
				repeated = feature.stop();
				feature.start();
			}
		});
		const completion = feature.stop();
		await completion;
		expect(repeated).toBeDefined();
		await repeated;
		expect(status.getSnapshot()).toBe(kind === 'component' ? 'mounted' : 'bound');
	});

	it('starts one later execution after stop then start, and stays stopped after stop then start then stop', async () => {
		const host = hostElement();
		const mounts: string[] = [];
		let mode: 'restart' | 'cancel' = 'restart';
		let completion: Promise<void> | undefined;
		const core = createMakoo();
		core.useAdapter(
			adapter(({ injection }) => {
				mounts.push(mode);
				if (mounts.length === 1) {
					completion = injection.command.stop();
					injection.command.start();
					if (mode === 'cancel') injection.command.stop();
				}
				return mounts.length;
			})
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		handles.push(panel);
		await completion;
		expect(mounts).toEqual(['restart', 'restart']);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
		expect(host.querySelectorAll('div')).toHaveLength(1);
		mode = 'cancel';
		mounts.length = 0;
		await panel.stop();
		panel.start();
		await completion;
		expect(mounts).toEqual(['cancel']);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('idle');
	});

	it('drops a queued start when remove wins during mount', async () => {
		hostElement();
		const core = createMakoo();
		let completion: Promise<void> | undefined;
		const mount = vi.fn(({ injection }: AdapterMountParams) => {
			injection.command.stop();
			injection.command.start();
			completion = injection.command.remove();
			return 'handle';
		});
		core.useAdapter(adapter(mount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		expect(mount).toHaveBeenCalledOnce();
		await completion;
		expect(() => core.injection('panel').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
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
					const panel = core.injection('panel').command;
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
		const panel = core.injection('panel').command;
		handles.push(panel);
		await panel.stop();
		expect(mounts).toBe(2);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
		mode = 'cancel';
		await panel.stop();
		expect(mounts).toBe(2);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('idle');
		panel.start();
		expect(mounts).toBe(3);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
		mode = 'remove';
		await panel.remove();
		expect(mounts).toBe(3);
		expect(() => core.injection('panel').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
	});

	it('still removes the container when unmount throws, and repeats the same failure', async () => {
		const host = hostElement();
		const core = createMakoo();
		const mount = vi.fn(() => 'handle');
		const unmount = vi.fn(() => {
			core.injection('panel').command.start();
			throw new Error('unmount failed');
		});
		core.useAdapter(adapter(mount, unmount));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const panel = core.injection('panel').command;
		handles.push(panel);
		const container = host.querySelector('div');
		const first = panel.stop();
		const second = panel.stop();
		const [firstResult, secondResult] = await Promise.allSettled([first, second]);
		expect(firstResult).toMatchObject({
			status: 'rejected',
			reason: {
				code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
				errors: [
					expect.objectContaining({
						code: MakooErrorCode.UNMOUNT_FAILED,
						cause: expect.objectContaining({ message: 'unmount failed' })
					})
				]
			}
		});
		expect(secondResult).toEqual(firstResult);
		expect(unmount).toHaveBeenCalledOnce();
		expect(mount).toHaveBeenCalledOnce();
		expect(container?.isConnected).toBe(false);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed');
		await expect(panel.remove()).rejects.toBe(await first.catch((error: unknown) => error));
		expect(unmount).toHaveBeenCalledOnce();
		expect(core.injection('panel').statusHandle.lastError).toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: [
				expect.objectContaining({
					code: MakooErrorCode.UNMOUNT_FAILED,
					cause: expect.objectContaining({ message: 'unmount failed' })
				})
			]
		});
		expect(() =>
			core.apply([listen({ name: 'panel', listenAt: '#host', type: 'click', callback() {} })])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
		expect(() => core.injection('panel').command).not.toThrow();
	});

	it('preserves the mount error when a later cleanup step fails', async () => {
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
		const panel = core.injection('panel').command;
		handles.push(panel);
		await vi.waitFor(
			() => expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed'),
			{
				interval: 1
			}
		);
		expect(unmount).not.toHaveBeenCalled();
		expect(host.querySelector('div')?.isConnected).toBe(true);
		expect(core.injection('panel').statusHandle.lastError).toMatchObject({
			code: 'MAKOO_INJECTION_CLEANUP_FAILED',
			errors: [
				expect.objectContaining({
					code: 'MAKOO_MOUNT_FAILED',
					cause: expect.objectContaining({ message: 'mount failed' })
				}),
				expect.objectContaining({
					code: 'MAKOO_CONTAINER_REMOVE_FAILED',
					cause: expect.objectContaining({ message: 'remove failed' })
				})
			]
		});
		expect(console.error).toHaveBeenCalledWith(core.injection('panel').statusHandle.lastError);
		const diagnostic = core.injection('panel').statusHandle.lastError;
		expect(() => panel.start()).toThrow(/cannot restart after cleanup failed/);
		expect(core.injection('panel').statusHandle.lastError).toBe(diagnostic);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('failed');
	});

	it('allows an explicit restart after an ordinary mount failure whose cleanup succeeded', async () => {
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
		const panel = core.injection('panel').command;
		handles.push(panel);
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
		expect(core.injection('panel').statusHandle.lastError).not.toBeInstanceOf(
			MakooAggregateError
		);
		expect(unmount).not.toHaveBeenCalled();
		fail = false;
		panel.start();
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
		expect(core.injection('panel').statusHandle.lastError).toBeUndefined();
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
		handles.push(core.listener('play').command, core.injection('panel').command);
		await expect(core.injection('panel').command.stop()).rejects.toMatchObject({
			code: 'MAKOO_INJECTION_CLEANUP_FAILED'
		});
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(core.listener('play').statusHandle.getSnapshot()).toBe('bound');
	});

	it('keeps a removed injection from affecting a same-name replacement', async () => {
		const host = hostElement();
		const core = createMakoo();
		core.useAdapter(adapter(() => 'handle'));
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const previous = core.injection('panel').command;
		const previousStatus = core.injection('panel').statusHandle;
		const seen: string[] = [];
		previousStatus.subscribe(() => seen.push(previousStatus.getSnapshot()));
		await previous.remove();
		seen.length = 0;
		expect(() => core.injection('panel').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		core.apply([inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })]);
		const replacement = core.injection('panel').command;
		handles.push(replacement);
		expect(replacement).not.toBe(previous);
		expect(core.injection('panel').statusHandle).not.toBe(previousStatus);
		await replacement.stop();
		expect(seen).toEqual([]);
		expect(core.injection('panel').statusHandle.getSnapshot()).toBe('idle');
		expect(() => previous.start()).toThrow(/was removed/);
		await previous.remove();
		await previous.stop();
		expect(core.injection('panel').command).toBe(replacement);
		expect(host.querySelector('div')).toBeNull();
	});

	it('shares listener cleanup and restarts only when the latest intent says to', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const callback = vi.fn();
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const play = core.listener('play').command;
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
		await Promise.all([first, second]);
		expect(core.listener('play').statusHandle.getSnapshot()).toBe('idle');
		button.click();
		expect(callback).not.toHaveBeenCalled();
		const callsAfterStop = unbind.mock.calls.length;
		await play.stop();
		expect(unbind.mock.calls.length).toBe(callsAfterStop);
		handled = false;
		mode = 'restart';
		play.start();
		await play.stop();
		expect(core.listener('play').statusHandle.getSnapshot()).toBe('bound');
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
		const play = core.listener('play').command;
		handles.push(play);
		const add = vi.spyOn(button, 'addEventListener');
		vi.spyOn(button, 'removeEventListener').mockImplementation(() => {
			play.start();
			throw new Error('unbind failed');
		});
		button.remove();
		await Promise.resolve();
		expect(core.listener('play').statusHandle.getSnapshot()).toBe('failed');
		expect(core.listener('play').statusHandle.lastError).toMatchObject({
			code: 'MAKOO_INJECTION_CLEANUP_FAILED',
			errors: [
				expect.objectContaining({ code: 'MAKOO_LISTENER_TARGET_DETACHED' }),
				expect.objectContaining({ code: 'MAKOO_LISTENER_UNBIND_FAILED' })
			]
		});
		expect(console.error).toHaveBeenCalledWith(core.listener('play').statusHandle.lastError);
		expect(add).not.toHaveBeenCalled();
		const diagnostic = core.listener('play').statusHandle.lastError;
		expect(() => play.start()).toThrow(/cannot restart after cleanup failed/);
		expect(core.listener('play').statusHandle.lastError).toBe(diagnostic);
		const first = play.stop();
		await Promise.all([
			expect(first).rejects.toBe(diagnostic),
			expect(play.remove()).rejects.toBe(diagnostic)
		]);
		expect(() => core.listener('play').command).not.toThrow();
	});

	it('keeps a removed listener from affecting a same-name replacement', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const previous = core.listener('play').command;
		const previousStatus = core.listener('play').statusHandle;
		const seen: string[] = [];
		previousStatus.subscribe(() => seen.push(previousStatus.getSnapshot()));
		await previous.remove();
		seen.length = 0;
		expect(() => core.listener('play').command).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const replacement = core.listener('play').command;
		handles.push(replacement);
		await replacement.stop();
		expect(seen).toEqual([]);
		expect(() => previous.start()).toThrow(/was removed/);
		await previous.remove();
		expect(core.listener('play').command).toBe(replacement);
	});
});
