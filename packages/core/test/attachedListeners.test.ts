import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createMakoo,
	type ComponentControl,
	type InjectionControl,
	inject,
	type ListenerSnapshot,
	listen,
	type MakooListenerDeclaration,
	type StateView
} from '../src';

describe('attached host listeners', () => {
	const controls: InjectionControl[] = [];
	function element(selector: string): HTMLElement {
		const target = document.querySelector<HTMLElement>(selector);
		if (!target) throw new Error(`Missing test element: ${selector}`);
		return target;
	}
	function setup(listeners: readonly MakooListenerDeclaration[], reinject = false) {
		const core = createMakoo();
		let panel!: ComponentControl;
		const mount = vi.fn(({ control }: { control: ComponentControl }) => {
			panel = control;
		});
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
		controls.push(core.get('panel'));
		return { core, panel, mount, unmount };
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
		const { core, panel } = setup([child('play', callback)]);
		const oldState = panel.listenerState('play');
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
		const replacement = core.get('panel');
		controls.push(replacement);
		if (!('listenerState' in replacement)) throw new Error('Expected a component');
		const newState = replacement.listenerState('play');
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
		expect(oldState.getSnapshot().status).toBe('idle');
		expect(replacement.lastError).toBeUndefined();
		expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ cause }));
	});
	it.each([
		false,
		true
	])('rechecks a selected child target before binding (reinject=%s)', async (reinject) => {
		const button = element('#play');
		vi.spyOn(button, 'isConnected', 'get').mockReturnValueOnce(true).mockReturnValue(false);
		const bind = vi.spyOn(button, 'addEventListener');
		const { panel } = setup([child()], reinject);
		expect(bind).not.toHaveBeenCalled();
		expect(panel.listenerState('play').getSnapshot().status).toBe(reinject ? 'waiting' : 'failed');
		await vi.waitFor(
			() => expect(panel.state.getSnapshot().status).toBe(reinject ? 'mounted' : 'failed'),
			{ interval: 1 }
		);
		await panel.stop();
	});
	it('stops local recovery immediately when a waiting subscriber stops the parent', async () => {
		const { panel } = setup([child()], true);
		const state = panel.listenerState('play');
		let completion: Promise<void> | undefined;
		const unsubscribe = state.subscribe(() => {
			if (state.getSnapshot().status === 'waiting') completion = panel.stop();
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
		expect(panel.state.getSnapshot().status).toBe('idle');
		expect(state.getSnapshot().status).toBe('idle');
		unsubscribe();
	});
	it('does not apply an old child failure to a parent restarted by a state subscriber', async () => {
		const { panel, mount } = setup([child('missing')], true);
		const state = panel.listenerState('missing');
		const unsubscribe = state.subscribe(() => {
			if (state.getSnapshot().status !== 'failed') return;
			const button = document.createElement('button');
			button.id = 'missing';
			document.body.append(button);
			void panel.stop();
			panel.start();
		});
		await vi.advanceTimersByTimeAsync(50);
		expect(mount).toHaveBeenCalledTimes(2);
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(state.getSnapshot().status).toBe('bound');
		expect(panel.lastError).toBeUndefined();
		unsubscribe();
	});
	it('keeps accepted child declarations fixed when the original inputs change', async () => {
		const callback = vi.fn();
		const input = { name: 'play', listenAt: '#play', type: 'click', callback };
		const listeners = [listen(input)];
		const { panel } = setup(listeners);
		await panel.stop();
		Object.assign(listeners[0], { listenAt: '#pause', callback: vi.fn() });
		listeners.push(child('extra'));
		panel.start();
		element('#play').click();
		expect(callback).toHaveBeenCalledOnce();
		expect(() => panel.listenerState('extra')).toThrow();
	});
	it('uses the default 15 second child search budget', async () => {
		const { panel } = setup([
			listen({ name: 'missing', listenAt: '#missing', type: 'click', callback() {} })
		]);
		await vi.advanceTimersByTimeAsync(14999);
		expect(panel.listenerState('missing').getSnapshot().status).toBe('waiting');
		await vi.advanceTimersByTimeAsync(1);
		expect(panel.state.getSnapshot().status).toBe('failed');
	});
	it('keeps child views stable across overall reinjection and replaces cancelled bindings', async () => {
		const callback = vi.fn();
		const { panel, mount, unmount } = setup([child('play', callback), child('pause')], true);
		const state = panel.listenerState('play');
		const notify = vi.fn();
		const unsubscribe = state.subscribe(notify);
		const oldHost = element('#host');
		oldHost.remove();
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('waiting'), {
			interval: 1
		});
		expect(unmount).toHaveBeenCalledOnce();
		expect(panel.state.getSnapshot().status).toBe('waiting');
		expect(state.getSnapshot().status).toBe('idle');
		const button = element('#play');
		button.click();
		expect(callback).not.toHaveBeenCalled();
		document.body.append(oldHost);
		await Promise.resolve();
		expect(mount).toHaveBeenCalledTimes(2);
		expect(panel.listenerState('play')).toBe(state);
		expect(state.getSnapshot().status).toBe('bound');
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
		const { panel } = setup([child('missing', callback)], true);
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
		expect(panel.listenerState('missing').getSnapshot().status).toBe('idle');
	});
	it.each([
		'stop',
		'remove',
		'detach',
		'throw'
	] as const)('does not start children after mount is interrupted by %s', async (action) => {
		const core = createMakoo();
		const bind = vi.spyOn(element('#play'), 'addEventListener');
		let panel!: ComponentControl;
		core.useAdapter({
			name: 'plain',
			mount({ control }) {
				panel = control;
				if (action === 'throw') throw new Error('mount failed');
				if (action === 'detach') element('#host').remove();
				else void control[action]();
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
		expect(panel.listenerState('play').getSnapshot().status).toBe('idle');
		await Promise.resolve();
	});
	it('isolates child names from other parents and the top-level namespace', () => {
		const callback = vi.fn();
		const { core, panel } = setup([child('play', callback)]);
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
		controls.push(core.get('play'), core.get('other'));
		expect(panel.listenerState('play')).not.toBe(core.get('play').state);
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
		const { panel, unmount } = setup([child('play', callback)]);
		const state = panel.listenerState('play');
		const snapshot = state.getSnapshot();
		const notify = vi.fn();
		const unsubscribe = state.subscribe(notify);
		element('#play').click();
		await Promise.resolve();
		expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ cause }));
		expect(state.getSnapshot()).toBe(snapshot);
		expect(notify).not.toHaveBeenCalled();
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(unmount).not.toHaveBeenCalled();
		unsubscribe();
	});
	it('uses a fresh recovery budget without resetting it on unrelated DOM changes', async () => {
		const { panel } = setup([child()], true);
		await vi.advanceTimersByTimeAsync(40);
		element('#play').remove();
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(40);
		expect(panel.listenerState('play').getSnapshot().status).toBe('waiting');
		document.body.append(document.createElement('aside'));
		await vi.advanceTimersByTimeAsync(10);
		expect(panel.state.getSnapshot().status).toBe('failed');
	});
	it('does not start later children when a state subscriber invalidates the mount target', async () => {
		const core = createMakoo();
		const host = element('#host');
		const bindPause = vi.spyOn(element('#pause'), 'addEventListener');
		let panel!: ComponentControl;
		core.useAdapter({
			name: 'plain',
			mount({ control }) {
				panel = control;
				control.listenerState('play').subscribe(() => {
					if (control.listenerState('play').getSnapshot().status === 'bound') host.remove();
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
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('failed'), {
			interval: 1
		});
		await panel.stop();
	});
	it.each([
		false,
		true
	])('waits for an already-running child cleanup before unmounting (failure=%s)', async (fails) => {
		const { panel, unmount } = setup([child()], true);
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
		expect(panel.state.getSnapshot().status).toBe(fails ? 'failed' : 'idle');
	});
	it.each([
		'restart',
		'stop',
		'remove'
	] as const)('applies the latest %s intent while child cleanup is awaiting completion', async (intent) => {
		const callback = vi.fn();
		const { core, panel, mount, unmount } = setup(
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
		expect(panel.state.getSnapshot().status).toBe(intent === 'restart' ? 'mounted' : 'idle');
		play.click();
		pause.click();
		expect(callback).toHaveBeenCalledTimes(intent === 'restart' ? 2 : 0);
		if (intent === 'remove') expect(() => core.get('panel')).toThrow();
	});
	it('invalidates every child before cleanup notifications and still unmounts when one unbind fails', async () => {
		const callback = vi.fn();
		const { panel, unmount } = setup([child(), child('pause', callback)], true);
		const play = element('#play');
		const pause = element('#pause');
		panel.listenerState('play').subscribe(() => {
			pause.click();
		});
		const cause = new Error('cannot unbind');
		vi.spyOn(play, 'removeEventListener').mockImplementation(() => {
			throw cause;
		});
		const removePause = vi.spyOn(pause, 'removeEventListener');
		await expect(panel.stop()).rejects.toMatchObject({ cause });
		expect(callback).not.toHaveBeenCalled();
		expect(removePause).toHaveBeenCalled();
		expect(unmount).toHaveBeenCalledOnce();
		expect(element('#host').children).toHaveLength(0);
		expect(panel.state.getSnapshot().status).toBe('failed');
		expect(panel.lastError?.cleanupErrors).toEqual(
			expect.arrayContaining([expect.objectContaining({ cause })])
		);
		expect(() => panel.start()).toThrow(/cleanup failed/);
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
		const { panel, mount, unmount } = setup(
			[child('play', callback), child('missing'), child('pause', pauseCallback)],
			true
		);
		const pauseSnapshot = panel.listenerState('pause').getSnapshot();
		const state = panel.listenerState('play');
		const bound = state.getSnapshot();
		expect(panel.state.getSnapshot().status).toBe('mounted');
		expect(panel.listenerState('missing').getSnapshot().status).toBe('waiting');
		const oldButton = element('#play');
		oldButton.remove();
		await Promise.resolve();
		expect(state.getSnapshot().status).toBe('waiting');
		expect(state.getSnapshot()).not.toBe(bound);
		oldButton.click();
		expect(callback).not.toHaveBeenCalled();
		const replacement = document.createElement('button');
		replacement.id = 'play';
		document.body.append(replacement);
		await Promise.resolve();
		expect(panel.listenerState('play')).toBe(state);
		expect(state.getSnapshot().status).toBe('bound');
		replacement.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(mount).toHaveBeenCalledOnce();
		expect(unmount).not.toHaveBeenCalled();
		expect(panel.listenerState('pause').getSnapshot()).toBe(pauseSnapshot);
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
		const { panel, mount, unmount } = setup([child(name)], failure !== 'detached');
		if (failure === 'recovery-timeout' || failure === 'detached') {
			element('#play').remove();
			await Promise.resolve();
		}
		if (failure.endsWith('timeout')) await vi.advanceTimersByTimeAsync(50);
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('failed'), {
			interval: 1
		});
		expect(panel.lastError?.context).toMatchObject({ injection: 'panel', listener: name });
		expect(panel.listenerState(name).getSnapshot().status).toBe('failed');
		if (failure === 'bind-failed') expect(panel.lastError?.cause).toBe(cause);
		expect(unmount).toHaveBeenCalledOnce();
		expect(element('#host').children).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(15000);
		expect(mount).toHaveBeenCalledOnce();
	});
	it.each([
		'duplicate',
		'override',
		'invalid-selector'
	])('rejects %s before starting any declaration', (invalid) => {
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
		).toThrow();
		expect(mount).not.toHaveBeenCalled();
		expect(() => core.get('first')).toThrow();
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
		let panel!: ComponentControl;
		let state!: StateView<ListenerSnapshot>;
		core.useAdapter({
			name: 'plain',
			mount({ control }) {
				panel = control;
				state = control.listenerState('play');
				expect(state.getSnapshot().status).toBe('idle');
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
		controls.push(core.get('panel'));
		expect(core.get('panel').state.getSnapshot().status).toBe('mounted');
		expect(state.getSnapshot().status).toBe('bound');
		expect(Object.keys(state).sort()).toEqual(['getSnapshot', 'subscribe']);
		expect(panel.listenerState('play')).toBe(state);
		expect(() => panel.listenerState('missing')).toThrow();
		expect(() => core.get('play')).toThrow();
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		await panel.stop();
		button.click();
		expect(callback).toHaveBeenCalledOnce();
	});
});
