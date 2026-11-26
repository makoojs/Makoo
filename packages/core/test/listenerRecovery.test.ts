import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakoo, type ListenerInjection, listen } from '../src';

describe('host listener waiting and recovery', () => {
	const handles: ListenerInjection[] = [];
	beforeEach(() => {
		document.body.replaceChildren();
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		for (const handle of handles.splice(0)) handle.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it.each([
		undefined,
		50
	])('times out once with budget %s, without resetting for DOM changes', async (timeout) => {
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback, timeout })]);
		const handle = core.listener('play');
		handles.push(handle);
		const budget = timeout ?? 15000;
		vi.advanceTimersByTime(budget - 1);
		document.body.append(document.createElement('div'));
		await Promise.resolve();
		expect(handle.status).toBe('waiting');
		vi.advanceTimersByTime(1);
		expect(handle.status).toBe('failed');
		expect(handle.lastError).toMatchObject({
			code: 'MAKOO_TARGET_WAIT_TIMEOUT',
			message: expect.stringContaining('play')
		});
		expect(vi.getTimerCount()).toBe(0);
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		await Promise.resolve();
		button.click();
		expect(callback).not.toHaveBeenCalled();
		expect(handle.status).toBe('failed');
		handle.start();
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(handle.lastError).toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([
		false,
		true
	])('cleans up an ancestor removal and applies reinject=%s', async (reinject) => {
		const parent = document.createElement('div');
		const first = document.createElement('button');
		first.className = 'host';
		parent.append(first);
		document.body.append(parent);
		const callback = vi.fn();
		const core = createMakoo();
		core.apply([
			listen({
				name: 'play',
				listenAt: '.host',
				type: 'click',
				callback,
				reinject,
				timeout: 50
			})
		]);
		const handle = core.listener('play');
		handles.push(handle);
		const changes: string[] = [];
		handle.subscribe(() => changes.push(handle.status));
		vi.advanceTimersByTime(100);
		parent.remove();
		await Promise.resolve();
		first.click();
		expect(callback).not.toHaveBeenCalled();
		expect(handle.status).toBe(reinject ? 'waiting' : 'failed');
		const second = first.cloneNode() as HTMLButtonElement;
		document.body.append(second);
		await Promise.resolve();
		second.click();
		expect(callback).toHaveBeenCalledTimes(reinject ? 1 : 0);
		expect(core.listener('play')).toBe(handle);
		expect(changes).toEqual(reinject ? ['waiting', 'bound'] : ['failed']);
	});

	it('preserves a connected target through same-batch moves and selector or content changes', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([
			listen({ name: 'play', listenAt: '.host', type: 'click', callback, reinject: true })
		]);
		const handle = core.listener('play');
		handles.push(handle);
		const snapshot = handle.status;
		const changed = vi.fn();
		handle.subscribe(changed);
		button.remove();
		document.body.append(button);
		button.className = 'renamed';
		button.textContent = 'changed';
		await Promise.resolve();
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(handle.status).toBe(snapshot);
		expect(changed).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('gives recovery a fresh budget and stops retrying after recovery timeout', async () => {
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([
			listen({
				name: 'play',
				listenAt: '.host',
				type: 'click',
				callback,
				timeout: 100,
				reinject: true
			})
		]);
		const handle = core.listener('play');
		handles.push(handle);
		vi.advanceTimersByTime(90);
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		await Promise.resolve();
		vi.advanceTimersByTime(1000);
		button.remove();
		await Promise.resolve();
		vi.advanceTimersByTime(99);
		expect(handle.status).toBe('waiting');
		vi.advanceTimersByTime(1);
		expect(handle.status).toBe('failed');
		expect(vi.getTimerCount()).toBe(0);
		document.body.append(button);
		await Promise.resolve();
		vi.advanceTimersByTime(1000);
		button.click();
		expect(callback).not.toHaveBeenCalled();
		expect(handle.status).toBe('failed');
	});

	it.each([
		'stop',
		'remove'
	] as const)('cancels pending discovery before queued notifications after %s', async (operation) => {
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([
			listen({ name: 'play', listenAt: '.host', type: 'click', callback, reinject: true })
		]);
		const handle = core.listener('play');
		handles.push(handle);
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		handle[operation]();
		await Promise.resolve();
		button.click();
		expect(callback).not.toHaveBeenCalled();
		expect(handle.status).toBe('idle');
		expect(vi.getTimerCount()).toBe(0);
		if (operation === 'stop') {
			handle.start();
			button.click();
			expect(callback).toHaveBeenCalledOnce();
		}
	});

	it('shares one native observer per core and releases it only after the last demand ends', async () => {
		const NativeObserver = MutationObserver;
		const observers: MutationObserver[] = [];
		vi.stubGlobal(
			'MutationObserver',
			class extends NativeObserver {
				constructor(callback: MutationCallback) {
					super(callback);
					observers.push(this);

					vi.spyOn<MutationObserver, 'disconnect'>(this, 'disconnect');
				}
			}
		);
		const button = document.createElement('button');
		button.id = 'bound';
		document.body.append(button);
		const first = createMakoo();
		const second = createMakoo();
		const callback = vi.fn();
		first.apply([
			listen({ name: 'bound', listenAt: '#bound', type: 'click', callback }),
			listen({ name: 'waiting', listenAt: '#later', type: 'click', callback })
		]);
		second.apply([listen({ name: 'waiting', listenAt: '#later', type: 'click', callback })]);
		handles.push(
			first.listener('bound'),
			first.listener('waiting'),
			second.listener('waiting')
		);
		expect(observers).toHaveLength(2);
		const disconnects = vi.mocked(observers[0].disconnect).mock.calls.length;
		first.listener('waiting').stop();
		expect(vi.mocked(observers[0].disconnect).mock.calls.length).toBe(disconnects);
		button.click();
		expect(callback).toHaveBeenCalledOnce();
		first.listener('bound').stop();
		expect(vi.mocked(observers[0].disconnect).mock.calls.length).toBe(disconnects + 1);
		button.id = 'later';
		await Promise.resolve();
		expect(second.listener('waiting').status).toBe('bound');
		second.listener('waiting').stop();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('checks each pending search once per mutation delivery, without a debounce timer', async () => {
		const core = createMakoo();
		core.apply(
			['a', 'b'].map((name) =>
				listen({ name, listenAt: `#${name}`, type: 'click', callback() {} })
			)
		);
		handles.push(core.listener('a'), core.listener('b'));
		const query = vi.spyOn(document, 'querySelectorAll');
		for (let index = 0; index < 5; index++) document.body.append(document.createElement('div'));
		await Promise.resolve();
		expect(query.mock.calls.map(([selector]) => selector)).toEqual(['#a', '#b']);
		expect(vi.getTimerCount()).toBe(2);
	});

	it('ignores a canceled search already included in the current delivery', async () => {
		const core = createMakoo();
		const firstCallback = vi.fn();
		const secondCallback = vi.fn();
		core.apply([
			listen({ name: 'first', listenAt: '#first', type: 'click', callback: firstCallback }),
			listen({ name: 'second', listenAt: '#second', type: 'click', callback: secondCallback })
		]);
		const first = core.listener('first');
		const second = core.listener('second');
		handles.push(first, second);
		first.subscribe(() => {
			if (first.status === 'bound') second.stop();
		});
		const a = document.createElement('button');
		a.id = 'first';
		const b = document.createElement('button');
		b.id = 'second';
		document.body.append(a, b);
		await Promise.resolve();
		a.click();
		b.click();
		expect(firstCallback).toHaveBeenCalledOnce();
		expect(secondCallback).not.toHaveBeenCalled();
		expect(second.status).toBe('idle');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('isolates cancellation, replacement, and timeout across simultaneous listeners', async () => {
		const core = createMakoo();
		const callbacks = [vi.fn(), vi.fn(), vi.fn()];
		core.apply(
			['a', 'b', 'c'].map((name, i) =>
				listen({
					name,
					listenAt: `#${name}`,
					type: 'click',
					callback: callbacks[i],
					reinject: true,
					timeout: 100
				})
			)
		);
		handles.push(...['a', 'b', 'c'].map((name) => core.listener(name)));
		core.listener('a').stop();
		const b = document.createElement('button');
		b.id = 'b';
		const c = document.createElement('button');
		c.id = 'c';
		document.body.append(b, c);
		await Promise.resolve();
		b.remove();
		await Promise.resolve();
		vi.advanceTimersByTime(100);
		expect(core.listener('a').status).toBe('idle');
		expect(core.listener('b').status).toBe('failed');
		expect(core.listener('c').status).toBe('bound');
		const replacement = c.cloneNode() as HTMLButtonElement;
		c.replaceWith(replacement);
		await Promise.resolve();
		c.click();
		replacement.click();
		expect(callbacks[2]).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('can stop recovery from a waiting state notification before any new binding', async () => {
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const callback = vi.fn();
		const core = createMakoo();
		core.apply([
			listen({ name: 'play', listenAt: '.host', type: 'click', callback, reinject: true })
		]);
		const handle = core.listener('play');
		handles.push(handle);
		handle.subscribe(() => {
			if (handle.status === 'waiting') handle.stop();
		});
		button.remove();
		await Promise.resolve();
		const replacement = button.cloneNode() as HTMLButtonElement;
		document.body.append(replacement);
		await Promise.resolve();
		replacement.click();
		expect(callback).not.toHaveBeenCalled();
		expect(handle.status).toBe('idle');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('reports observer setup failure and stays unbound', async () => {
		const cause = new Error('observer setup failed');
		vi.spyOn(MutationObserver.prototype, 'observe').mockImplementationOnce(() => {
			throw cause;
		});
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([
			listen({ name: 'play', listenAt: '.host', type: 'click', callback, reinject: true })
		]);
		const handle = core.listener('play');
		handles.push(handle);
		expect(handle.status).toBe('failed');
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		await Promise.resolve();
		button.click();
		expect(callback).not.toHaveBeenCalled();
		expect(handle.status).toBe('failed');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not let a canceled timeout fail a later execution with a fresh budget', async () => {
		const core = createMakoo();
		core.apply([
			listen({ name: 'play', listenAt: '.host', type: 'click', callback() {}, timeout: 100 })
		]);
		const handle = core.listener('play');
		handles.push(handle);
		vi.advanceTimersByTime(99);
		handle.stop();
		handle.start();
		vi.advanceTimersByTime(1);
		expect(handle.status).toBe('waiting');
		vi.advanceTimersByTime(99);
		expect(handle.status).toBe('failed');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps a late business rejection from overwriting the recovered execution diagnostic', async () => {
		let reject: (cause: unknown) => void = () => {};
		const pending = new Promise<void>((_resolve, fail) => {
			reject = fail;
		});
		const button = document.createElement('button');
		button.className = 'host';
		document.body.append(button);
		const core = createMakoo();
		core.apply([
			listen({
				name: 'play',
				listenAt: '.host',
				type: 'click',
				callback: () => pending,
				reinject: true
			})
		]);
		const handle = core.listener('play');
		handles.push(handle);
		button.click();
		button.replaceWith(button.cloneNode());
		await Promise.resolve();
		const snapshot = handle.status;
		reject(new Error('old execution'));
		await Promise.resolve();
		expect(handle.status).toBe(snapshot);
		expect(snapshot).toBe('bound');
		expect(handle.lastError).toBeUndefined();
	});

	it('waits for the first delayed host, then stops searching for additional matches', async () => {
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const handle = core.listener('play');
		handles.push(handle);
		expect(handle.status).toBe('waiting');
		const changes: string[] = [];
		handle.subscribe(() => changes.push(handle.status));
		const first = document.createElement('button');
		first.className = 'host';
		document.body.append(first);
		await Promise.resolve();
		expect(handle.status).toBe('bound');
		const second = first.cloneNode() as HTMLButtonElement;
		document.body.append(second);
		await Promise.resolve();
		first.click();
		second.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(core.listener('play')).toBe(handle);
		expect(changes).toEqual(['bound']);
	});
});
