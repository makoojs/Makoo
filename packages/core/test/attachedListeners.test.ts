import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type ComponentCommand,
	type ComponentStatusHandle,
	createMakoo,
	type InjectionCommand,
	inject,
	type ListenerStatus,
	listen,
	MakooErrorCode,
	type MakooListenerDeclaration,
	type StateView
} from '../src';

describe('attached host listeners', () => {
	const controls: InjectionCommand[] = [];
	function element(selector: string): HTMLElement {
		const target = document.querySelector<HTMLElement>(selector);
		if (!target) throw new Error(`Missing test element: ${selector}`);
		return target;
	}
	function listenerOf(status: ComponentStatusHandle, name: string): StateView<ListenerStatus> {
		if (!('attachedListener' in status)) throw new Error('Expected a component');
		return status.attachedListener(name);
	}
	function setup(listeners: readonly MakooListenerDeclaration[], reinject = false) {
		const core = createMakoo();
		let panel!: ComponentCommand;
		let status!: ComponentStatusHandle;
		const mount = vi.fn(
			({
				command,
				statusHandle: mountStatus
			}: {
				command: ComponentCommand;
				statusHandle: ComponentStatusHandle;
			}) => {
				panel = command;
				status = mountStatus;
			}
		);
		const unmount = vi.fn();
		core.useAdapter({ name: 'plain', mount, unmount });
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners,
				reinject
			})
		]);
		controls.push(core.command('panel'));
		return { core, panel, status, mount, unmount };
	}
	function child(name = 'play', callback = vi.fn(), timeout = 50) {
		return listen({ name, listenAt: `#${name}`, type: 'click', callback, timeout });
	}
	it('keeps late child diagnostics and old controls isolated from a replacement with the same name', async () => {
		let rejectHandler!: (error: Error) => void;
		const callback = vi.fn(
			() =>
				new Promise<void>((_resolve, reject) => {
					rejectHandler = reject;
				})
		);
		const { core, panel, status } = setup([child('play', callback)]);
		const oldState = listenerOf(status, 'play');
		element('#play').click();
		await panel.remove();
		const replacementCallback = vi.fn();
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [child('play', replacementCallback)]
			})
		]);
		const replacement = core.command('panel');
		controls.push(replacement);
		const replacementStatus = core.statusHandle('panel');
		if (!('attachedListener' in replacementStatus)) throw new Error('Expected a component');
		const newState = replacementStatus.attachedListener('play');
		const snapshot = newState.getSnapshot();
		expect(newState).not.toBe(oldState);
		const cause = new Error('late business failure');
		rejectHandler(cause);
		await Promise.resolve();
		await panel.stop();
		element('#play').click();
		expect(callback).toHaveBeenCalledOnce();
		expect(replacementCallback).toHaveBeenCalledOnce();
		expect(newState.getSnapshot()).toBe(snapshot);
		expect(oldState.getSnapshot()).toBe('idle');
		expect(core.statusHandle('panel').lastError).toBeUndefined();
		expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ cause }));
	});
	it('stops local recovery immediately when a waiting subscriber stops the parent', async () => {
		const { panel, status } = setup([child()], true);
		const state = listenerOf(status, 'play');
		let completion: Promise<void> | undefined;
		const unsubscribe = state.subscribe(() => {
			if (state.getSnapshot() === 'waiting') completion = panel.stop();
		});
		element('#play').remove();
		await Promise.resolve();
		const replacement = document.createElement('button');
		replacement.id = 'play';
		const bind = vi.spyOn(replacement, 'addEventListener');
		document.body.append(replacement);
		await Promise.resolve();
		expect(bind).not.toHaveBeenCalled();
		expect(completion).toBeDefined();
		await completion;
		expect(status.getSnapshot()).toBe('idle');
		expect(state.getSnapshot()).toBe('idle');
		unsubscribe();
	});
	it('does not apply an old child failure to a parent restarted by a state subscriber', async () => {
		const { panel, status, mount } = setup([child('missing')], true);
		const state = listenerOf(status, 'missing');
		const unsubscribe = state.subscribe(() => {
			if (state.getSnapshot() !== 'failed') return;
			const button = document.createElement('button');
			button.id = 'missing';
			document.body.append(button);
			void panel.stop();
			panel.start();
		});
		await vi.advanceTimersByTimeAsync(50);
		expect(mount).toHaveBeenCalledTimes(2);
		expect(status.getSnapshot()).toBe('mounted');
		expect(state.getSnapshot()).toBe('bound');
		expect(status.lastError).toBeUndefined();
		unsubscribe();
	});
	it('keeps accepted child declarations fixed when the original inputs change', async () => {
		const callback = vi.fn();
		const input = { name: 'play', listenAt: '#play', type: 'click', callback };
		const listeners = [listen(input)];
		const { panel, status } = setup(listeners);
		await panel.stop();
		Object.assign(listeners[0], { listenAt: '#pause', callback: vi.fn() });
		listeners.push(child('extra'));
		panel.start();
		element('#play').click();
		expect(callback).toHaveBeenCalledOnce();
		expect(() => listenerOf(status, 'extra')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.LISTENER_NOT_FOUND })
		);
	});
	it('uses the default 15 second child search budget', async () => {
		const { status } = setup([
			listen({ name: 'missing', listenAt: '#missing', type: 'click', callback() {} })
		]);
		await vi.advanceTimersByTimeAsync(14999);
		expect(listenerOf(status, 'missing').getSnapshot()).toBe('waiting');
		await vi.advanceTimersByTimeAsync(1);
		expect(status.getSnapshot()).toBe('failed');
	});
	it('keeps child views stable across overall reinjection and replaces cancelled bindings', async () => {
		const callback = vi.fn();
		const { status, mount, unmount } = setup([child('play', callback), child('pause')], true);
		const state = listenerOf(status, 'play');
		const notify = vi.fn();
		const unsubscribe = state.subscribe(notify);
		const oldHost = element('#host');
		oldHost.remove();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('waiting'), {
			interval: 1
		});
		expect(unmount).toHaveBeenCalledOnce();
		expect(status.getSnapshot()).toBe('waiting');
		expect(state.getSnapshot()).toBe('idle');
		const button = element('#play');
		button.click();
		expect(callback).not.toHaveBeenCalled();
		document.body.append(oldHost);
		await Promise.resolve();
		expect(mount).toHaveBeenCalledTimes(2);
		expect(listenerOf(status, 'play')).toBe(state);
		expect(state.getSnapshot()).toBe('bound');
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(notify).toHaveBeenCalledTimes(2);
		unsubscribe();
	});
	it.each([
		'stop',
		'remove',
		'host-detach'
	] as const)('cancels queued child discovery on parent %s', async (action) => {
		const callback = vi.fn();
		const { panel, status } = setup([child('missing', callback)], true);
		const button = document.createElement('button');
		button.id = 'missing';
		const bind = vi.spyOn(button, 'addEventListener');
		document.body.append(button);
		if (action === 'host-detach') element('#host').remove();
		else await panel[action]();
		await Promise.resolve();
		button.click();
		expect(bind).not.toHaveBeenCalled();
		expect(callback).not.toHaveBeenCalled();
		expect(listenerOf(status, 'missing').getSnapshot()).toBe('idle');
	});
	it.each([
		'stop',
		'remove',
		'detach',
		'throw'
	] as const)('does not start children after mount is interrupted by %s', async (action) => {
		const core = createMakoo();
		const bind = vi.spyOn(element('#play'), 'addEventListener');
		let panel!: ComponentCommand;
		let status!: ComponentStatusHandle;
		core.useAdapter({
			name: 'plain',
			mount({ command, statusHandle: mountStatus }) {
				panel = command;
				status = mountStatus;
				if (action === 'throw') throw new Error('mount failed');
				if (action === 'detach') element('#host').remove();
				else void command[action]();
			},
			unmount() {}
		});
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [child()]
			})
		]);
		controls.push(panel);
		expect(bind).not.toHaveBeenCalled();
		expect(listenerOf(status, 'play').getSnapshot()).toBe('idle');
		await Promise.resolve();
	});
	it('isolates child names from other parents and the top-level namespace', () => {
		const callback = vi.fn();
		const { core, status } = setup([child('play', callback)]);
		core.apply([
			child('play', callback),
			inject({
				name: 'other',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [child('play', callback)]
			})
		]);
		controls.push(core.command('play'), core.command('other'));
		expect(listenerOf(status, 'play')).not.toBe(core.statusHandle('play'));
		element('#play').click();
		expect(callback).toHaveBeenCalledTimes(3);
	});
	it.each([
		'throw',
		'reject'
	] as const)('reports business %s without replacing the snapshot or failing the parent', async (failure) => {
		const cause = new Error('business handler failed');
		const callback = vi.fn(() => {
			if (failure === 'throw') throw cause;
			return Promise.reject(cause);
		});
		const { status, unmount } = setup([child('play', callback)]);
		const state = listenerOf(status, 'play');
		const snapshot = state.getSnapshot();
		const notify = vi.fn();
		const unsubscribe = state.subscribe(notify);
		element('#play').click();
		await Promise.resolve();
		expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ cause }));
		expect(state.getSnapshot()).toBe(snapshot);
		expect(notify).not.toHaveBeenCalled();
		expect(status.getSnapshot()).toBe('mounted');
		expect(unmount).not.toHaveBeenCalled();
		unsubscribe();
	});
	it('uses a fresh recovery budget without resetting it on unrelated DOM changes', async () => {
		const { status } = setup([child()], true);
		await vi.advanceTimersByTimeAsync(40);
		element('#play').remove();
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(40);
		expect(listenerOf(status, 'play').getSnapshot()).toBe('waiting');
		document.body.append(document.createElement('aside'));
		await vi.advanceTimersByTimeAsync(10);
		expect(status.getSnapshot()).toBe('failed');
	});
	it('does not start later children when a state subscriber invalidates the mount target', async () => {
		const core = createMakoo();
		const host = element('#host');
		const bindPause = vi.spyOn(element('#pause'), 'addEventListener');
		let panel!: ComponentCommand;
		let status!: ComponentStatusHandle;
		core.useAdapter({
			name: 'plain',
			mount({ command, statusHandle: mountStatus }) {
				panel = command;
				status = mountStatus;
				const playStatus = mountStatus.attachedListener('play');
				playStatus.subscribe(() => {
					if (playStatus.getSnapshot() === 'bound') host.remove();
				});
			},
			unmount() {}
		});
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [child(), child('pause')]
			})
		]);
		controls.push(panel);
		expect(bindPause).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('failed'), {
			interval: 1
		});
		await panel.stop();
	});
	it('does not start later children when a state subscriber stops the parent', async () => {
		const core = createMakoo();
		const bindPause = vi.spyOn(element('#pause'), 'addEventListener');
		let panel!: ComponentCommand;
		let status!: ComponentStatusHandle;
		core.useAdapter({
			name: 'plain',
			mount({ command, statusHandle: mountStatus }) {
				panel = command;
				status = mountStatus;
				const playStatus = mountStatus.attachedListener('play');
				playStatus.subscribe(() => {
					if (playStatus.getSnapshot() === 'bound') void panel.stop();
				});
			},
			unmount() {}
		});
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [child(), child('pause')]
			})
		]);
		controls.push(panel);
		await vi.advanceTimersByTimeAsync(0);
		expect(bindPause).not.toHaveBeenCalled();
		expect(status.getSnapshot()).toBe('idle');
		expect(listenerOf(status, 'pause').getSnapshot()).toBe('idle');
	});
	it('keeps a child idle when its target disappears in the same turn the parent stops', async () => {
		const { panel, status } = setup([child(), child('pause')]);
		element('#pause').remove();
		await panel.stop();
		expect(status.getSnapshot()).toBe('idle');
		expect(listenerOf(status, 'pause').getSnapshot()).toBe('idle');
	});
	it('fails the parent when a child loses its target and its unbind also fails', async () => {
		const { status, unmount } = setup([child()]);
		const play = element('#play');
		const cause = new Error('cannot unbind');
		vi.spyOn(play, 'removeEventListener').mockImplementation(() => {
			throw cause;
		});
		play.remove();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('failed'), { interval: 1 });
		expect(listenerOf(status, 'play').getSnapshot()).toBe('failed');
		expect(unmount).toHaveBeenCalledOnce();
		expect(status.lastError).toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: expect.arrayContaining([
				expect.objectContaining({
					code: MakooErrorCode.ATTACHED_LISTENER_FAILED,
					message: expect.stringContaining('play')
				}),
				expect.objectContaining({ cause })
			])
		});
	});
	it.each([
		false,
		true
	])('waits for an already-running child cleanup before unmounting (failure=%s)', async (fails) => {
		const { panel, status, unmount } = setup([child()], true);
		const play = element('#play');
		const remove = play.removeEventListener.bind(play);
		const order: string[] = [];
		let completion!: Promise<void>;
		unmount.mockImplementation(() => {
			order.push('unmount');
		});
		vi.spyOn(play, 'removeEventListener').mockImplementation((...args) => {
			order.push('unbind-start');
			completion = panel.stop();
			void completion.catch(() => {});
			expect(unmount).not.toHaveBeenCalled();
			remove(...args);
			order.push('unbind-end');
			if (fails) throw new Error('late cleanup failure');
		});
		play.remove();
		await Promise.resolve();
		if (fails) await expect(completion).rejects.toThrow(/unbind/);
		else await completion;
		expect(order).toEqual(['unbind-start', 'unbind-end', 'unmount']);
		expect(status.getSnapshot()).toBe(fails ? 'failed' : 'idle');
	});
	it.each([
		'restart',
		'stop',
		'remove'
	] as const)('applies the latest %s intent while child cleanup is awaiting completion', async (intent) => {
		const callback = vi.fn();
		const { core, panel, status, mount, unmount } = setup(
			[child('play', callback), child('pause', callback)],
			true
		);
		const play = element('#play');
		const pause = element('#pause');
		const completion = panel.stop();
		play.click();
		pause.click();
		expect(callback).not.toHaveBeenCalled();
		expect(unmount).not.toHaveBeenCalled();
		panel.start();
		const latestCompletion = intent === 'restart' ? completion : panel[intent]();
		expect(mount).toHaveBeenCalledOnce();
		await Promise.all([completion, latestCompletion]);
		expect(unmount).toHaveBeenCalledOnce();
		expect(mount).toHaveBeenCalledTimes(intent === 'restart' ? 2 : 1);
		expect(status.getSnapshot()).toBe(intent === 'restart' ? 'mounted' : 'idle');
		play.click();
		pause.click();
		expect(callback).toHaveBeenCalledTimes(intent === 'restart' ? 2 : 0);
		if (intent === 'remove')
			expect(() => core.command('panel')).toThrow(
				expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
			);
	});
	it('invalidates every child before cleanup notifications and still unmounts when one unbind fails', async () => {
		const callback = vi.fn();
		const { panel, status, unmount } = setup([child(), child('pause', callback)], true);
		const play = element('#play');
		const pause = element('#pause');
		listenerOf(status, 'play').subscribe(() => {
			pause.click();
		});
		const cause = new Error('cannot unbind');
		vi.spyOn(play, 'removeEventListener').mockImplementation(() => {
			throw cause;
		});
		const removePause = vi.spyOn(pause, 'removeEventListener');
		await expect(panel.stop()).rejects.toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: expect.arrayContaining([expect.objectContaining({ cause })])
		});
		expect(callback).not.toHaveBeenCalled();
		expect(removePause).toHaveBeenCalled();
		expect(unmount).toHaveBeenCalledOnce();
		expect(element('#host').children).toHaveLength(0);
		expect(status.getSnapshot()).toBe('failed');
		expect(status.lastError).toMatchObject({
			errors: expect.arrayContaining([expect.objectContaining({ cause })])
		});
		expect(() => panel.start()).toThrow(/cleanup failed/);
	});
	it('names the listener when its state subscriber fails', async () => {
		const { status } = setup([child()]);
		const subscriberError = new Error('child subscriber failed');
		const listener = listenerOf(status, 'play');
		const seen: string[] = [];
		listener.subscribe(() => {
			throw subscriberError;
		});
		listener.subscribe(() => {
			seen.push(listener.getSnapshot());
		});
		element('#play').remove();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('failed'), { interval: 1 });
		expect(listener.getSnapshot()).toBe('failed');
		expect(seen).toContain('failed');
		expect(status.lastError).toMatchObject({
			code: MakooErrorCode.ATTACHED_LISTENER_FAILED
		});
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({
				code: MakooErrorCode.STATE_SUBSCRIBER_FAILED,
				cause: subscriberError,
				message: expect.stringContaining('"panel" listener "play"')
			})
		);
	});
	beforeEach(() => {
		document.body.innerHTML =
			'<section id="host"></section><button id="play"></button><button id="pause"></button>';
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	it('keeps the component mounted while a child waits and recovers only the missing child', async () => {
		const callback = vi.fn();
		const pauseCallback = vi.fn();
		const { status, mount, unmount } = setup(
			[child('play', callback), child('missing'), child('pause', pauseCallback)],
			true
		);
		const pauseSnapshot = listenerOf(status, 'pause').getSnapshot();
		const state = listenerOf(status, 'play');
		const bound = state.getSnapshot();
		expect(status.getSnapshot()).toBe('mounted');
		expect(listenerOf(status, 'missing').getSnapshot()).toBe('waiting');
		const oldButton = element('#play');
		oldButton.remove();
		await Promise.resolve();
		expect(state.getSnapshot()).toBe('waiting');
		expect(state.getSnapshot()).not.toBe(bound);
		oldButton.click();
		expect(callback).not.toHaveBeenCalled();
		const replacement = document.createElement('button');
		replacement.id = 'play';
		document.body.append(replacement);
		await Promise.resolve();
		expect(listenerOf(status, 'play')).toBe(state);
		expect(state.getSnapshot()).toBe('bound');
		replacement.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(mount).toHaveBeenCalledOnce();
		expect(unmount).not.toHaveBeenCalled();
		expect(listenerOf(status, 'pause').getSnapshot()).toBe(pauseSnapshot);
		element('#pause').click();
		expect(pauseCallback).toHaveBeenCalledOnce();
	});
	it.each([
		'initial-timeout',
		'recovery-timeout',
		'detached',
		'bind-failed'
	])('ends the injection on child %s with named diagnostics', async (failure) => {
		const cause = new Error('native bind failed');
		if (failure === 'bind-failed')
			vi.spyOn(element('#play'), 'addEventListener').mockImplementation(() => {
				throw cause;
			});
		const name = failure === 'initial-timeout' ? 'missing' : 'play';
		const { status, mount, unmount } = setup([child(name)], failure !== 'detached');
		if (failure === 'recovery-timeout' || failure === 'detached') {
			element('#play').remove();
			await Promise.resolve();
		}
		if (failure.endsWith('timeout')) await vi.advanceTimersByTimeAsync(50);
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('failed'), {
			interval: 1
		});
		expect(status.lastError).toMatchObject({
			code: MakooErrorCode.ATTACHED_LISTENER_FAILED,
			message: expect.stringContaining(name)
		});
		expect(status.lastError?.message).toContain('panel');
		expect(listenerOf(status, name).getSnapshot()).toBe('failed');
		if (failure === 'bind-failed') {
			expect(status.lastError?.cause).toMatchObject({
				code: MakooErrorCode.LISTENER_BIND_FAILED,
				cause
			});
		}
		expect(unmount).toHaveBeenCalledOnce();
		expect(element('#host').children).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(15000);
		expect(mount).toHaveBeenCalledOnce();
	});
	it.each([
		['duplicate', MakooErrorCode.INJECTION_NAME_CONFLICT, 'listeners[1]'],
		['override', MakooErrorCode.DECLARATION_INVALID, 'listeners[0].reinject'],
		['invalid-selector', MakooErrorCode.DECLARATION_INVALID, 'listeners[0]']
	])('rejects %s before starting any declaration', (invalid, code, path) => {
		const core = createMakoo();
		const mount = vi.fn();
		core.useAdapter({ name: 'plain', mount, unmount() {} });
		const child = listen({
			name: 'play',
			listenAt: invalid === 'invalid-selector' ? '[' : '#play',
			type: 'click',
			callback() {},
			...(invalid === 'override' ? { reinject: true } : {})
		});
		expect(() =>
			core.apply([
				inject({ name: 'first', injectAt: '#host', adapter: 'plain', component: {} }),
				inject({
					name: 'panel',
					injectAt: '#host',
					adapter: 'plain',
					component: {},
					listeners: invalid === 'duplicate' ? [child, child] : [child]
				})
			])
		).toThrow(
			expect.objectContaining({
				code,
				message: expect.stringContaining(path),
				...(invalid === 'invalid-selector'
					? {
							cause: expect.objectContaining({
								cause: expect.objectContaining({ issues: expect.any(Array) })
							})
						}
					: {})
			})
		);
		expect(mount).not.toHaveBeenCalled();
		expect(() => core.command('first')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
	});
	afterEach(async () => {
		for (const control of controls.splice(0)) await control.remove().catch(() => {});
		vi.restoreAllMocks();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('exposes stable readonly listener state during mount and binds only after mount returns', async () => {
		const core = createMakoo();
		const callback = vi.fn();
		const button = element('#play');
		let panel!: ComponentCommand;
		let state!: StateView<ListenerStatus>;
		core.useAdapter({
			name: 'plain',
			mount({ command, statusHandle }) {
				panel = command;
				state = statusHandle.attachedListener('play');
				expect(state.getSnapshot()).toBe('idle');
				button.click();
				expect(callback).not.toHaveBeenCalled();
			},
			unmount() {}
		});
		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'plain',
				component: {},
				listeners: [listen({ name: 'play', listenAt: '#play', type: 'click', callback })]
			})
		]);
		controls.push(core.command('panel'));
		const status = core.statusHandle('panel');
		if (!('attachedListener' in status)) throw new Error('Expected a component');
		expect(status.getSnapshot()).toBe('mounted');
		expect(status.attachedListenerNames).toEqual(['play']);
		expect(state.getSnapshot()).toBe('bound');
		expect(Object.keys(state).sort()).toEqual(['getSnapshot', 'subscribe']);
		expect(status.attachedListener('play')).toBe(state);
		expect(() => status.attachedListener('missing')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.LISTENER_NOT_FOUND })
		);
		expect(() => core.command('play')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		await panel.stop();
		button.click();
		expect(callback).toHaveBeenCalledOnce();
	});
});
