import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakoo, listen } from '../src';

describe('standalone host listeners', () => {
	beforeEach(() => {
		document.body.innerHTML = '<button class="host"></button><button class="host"></button>';
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it('declares without a document and fixes execution config at apply without freezing the caller', async () => {
		const callback = vi.fn();
		const replacement = vi.fn();
		const input = { name: 'play', listenAt: '.host', type: 'click', callback, capture: false };
		vi.stubGlobal('document', undefined);
		const declaration = listen(input);
		vi.unstubAllGlobals();
		const core = createMakoo();
		core.apply([declaration]);
		const handle = core.get('play');
		await handle.stop();
		Object.assign(declaration, {
			name: 'changed',
			listenAt: '#missing',
			type: 'keydown',
			callback: replacement,
			capture: true
		});
		input.callback = replacement;
		handle.start();
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(replacement).not.toHaveBeenCalled();
		expect(core.get('play')).toBe(handle);
		await handle.remove();
		expect(() => core.get('play')).toThrow();
	});

	it.each([
		{ name: '' },
		{ name: 1 },
		{ listenAt: '' },
		{ listenAt: '[' },
		{ type: '' },
		{ type: null },
		{ callback: null },
		{ capture: 'yes' },
		{ kind: 'unknown' }
	])('rejects the entire batch for invalid config %j before binding', (invalid) => {
		const callback = vi.fn();
		const core = createMakoo();
		const good = listen({ name: 'good', listenAt: '.host', type: 'click', callback });
		const bad = { ...good, name: 'bad', ...invalid };
		expect(() => Reflect.apply(core.apply, core, [[good, bad]])).toThrow();
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).not.toHaveBeenCalled();
		expect(() => core.get('good')).toThrow();
		expect(() => core.get('bad')).toThrow();
	});

	it('rejects duplicate and occupied names without disturbing accepted listeners', async () => {
		const core = createMakoo();
		const callback = vi.fn();
		const declaration = listen({ name: 'play', listenAt: '.host', type: 'click', callback });
		expect(() => core.apply([declaration, declaration])).toThrow();
		expect(() => core.get('play')).toThrow();
		core.apply([declaration]);
		const original = core.get('play');
		expect(() => core.apply([{ ...declaration, name: 'new' }, declaration])).toThrow();
		expect(() => core.get('new')).toThrow();
		expect(core.get('play')).toBe(original);
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).toHaveBeenCalledOnce();
		await original.remove();
	});

	it('keeps snapshots stable for events and repeated controls, and publishes changes to subscribers', async () => {
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const handle = core.get('play');
		const view = handle.state;
		const bound = view.getSnapshot();
		const changes: string[] = [];
		const unsubscribe = view.subscribe(() => {
			changes.push(view.getSnapshot().status);
		});
		handle.start();
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(view.getSnapshot()).toBe(bound);
		expect(changes).toEqual([]);
		await handle.stop();
		const idle = view.getSnapshot();
		expect(idle).not.toBe(bound);
		expect(Object.isFrozen(idle)).toBe(true);
		await handle.stop();
		expect(view.getSnapshot()).toBe(idle);
		handle.start();
		expect(handle.state).toBe(view);
		expect(changes).toEqual(['idle', 'bound']);
		unsubscribe();
		await handle.remove();
		expect(changes).toEqual(['idle', 'bound']);
	});

	it.each([
		'throw',
		'reject'
	] as const)('reports a handler %s without changing bound state', async (mode) => {
		const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
		const cause = new Error('business error');
		const callback = vi.fn(() => {
			if (mode === 'throw') throw cause;
			return Promise.reject(cause);
		});
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const handle = core.get('play');
		const snapshot = handle.state.getSnapshot();
		const button = document.querySelector<HTMLButtonElement>('.host');
		button?.click();
		await Promise.resolve();
		expect(handle.lastError).toMatchObject({
			cause,
			context: { feature: 'play', phase: 'event', reason: 'handler-failed' }
		});
		expect(reported).toHaveBeenCalledWith(handle.lastError);
		expect(handle.state.getSnapshot()).toBe(snapshot);
		button?.click();
		await Promise.resolve();
		expect(callback).toHaveBeenCalledTimes(2);
		await handle.stop();
		handle.start();
		expect(handle.lastError).toBeUndefined();
		await handle.remove();
	});

	it('accepts all records before execution and isolates binding failure from other listeners', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const core = createMakoo();
		const [first, second] = document.querySelectorAll<HTMLButtonElement>('.host');
		first.id = 'broken';
		second.id = 'healthy';
		const cause = new Error('binding denied');
		let healthyBeforeStart: string | undefined;
		vi.spyOn(first, 'addEventListener').mockImplementation(() => {
			healthyBeforeStart = core.get('healthy').state.getSnapshot().status;
			throw cause;
		});
		const callback = vi.fn();
		core.apply([
			listen({ name: 'broken', listenAt: '#broken', type: 'click', callback }),
			listen({ name: 'healthy', listenAt: '#healthy', type: 'click', callback })
		]);
		expect(healthyBeforeStart).toBe('idle');
		expect(core.get('broken').state.getSnapshot().status).toBe('failed');
		expect(core.get('broken').lastError).toMatchObject({
			cause,
			context: { feature: 'broken', phase: 'bind' }
		});
		second.click();
		expect(callback).toHaveBeenCalledOnce();
		await core.get('broken').stop();
		second.click();
		expect(callback).toHaveBeenCalledTimes(2);
		vi.restoreAllMocks();
		core.get('broken').start();
		first.click();
		expect(callback).toHaveBeenCalledTimes(3);
		await core.get('broken').remove();
		second.click();
		expect(callback).toHaveBeenCalledTimes(4);
		await core.get('healthy').remove();
	});

	it('uses the declared event and capture phase and supplies the real host as this', async () => {
		const target = document.querySelector<HTMLButtonElement>('.host');
		if (!target) throw new Error('missing fixture');
		const child = document.createElement('span');
		target.append(child);
		const seen: string[] = [];
		child.addEventListener('custom', () => {
			seen.push('child');
		});
		const core = createMakoo();
		let receiver: Element | undefined;
		core.apply([
			listen({
				name: 'capture',
				listenAt: '.host',
				type: 'custom',
				capture: true,
				callback(event) {
					receiver = this;
					expect(event.currentTarget).toBe(target);
					seen.push('host');
				}
			})
		]);
		child.dispatchEvent(new Event('custom'));
		expect(seen).toEqual(['host', 'child']);
		expect(receiver).toBe(target);
		await core.get('capture').stop();
		child.dispatchEvent(new Event('custom'));
		expect(seen).toEqual(['host', 'child', 'child']);
	});

	it('does not bind a host disconnected between discovery and use', async () => {
		const callback = vi.fn();
		const target = document.querySelector<HTMLButtonElement>('.host');
		if (!target) throw new Error('missing fixture');
		vi.spyOn(document, 'querySelector').mockImplementationOnce(() => {
			target.remove();
			return target;
		});
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		target.click();
		expect(callback).not.toHaveBeenCalled();
		expect(core.get('play').state.getSnapshot().status).not.toBe('bound');
		await core.get('play').remove();
	});

	it('keeps removed handles and late event errors isolated from a same-name replacement', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let reject: (error: Error) => void = () => {};
		const pending = new Promise<void>((_resolve, rejectPromise) => {
			reject = rejectPromise;
		});
		const core = createMakoo();
		core.apply([
			listen({ name: 'play', listenAt: '.host', type: 'click', callback: () => pending })
		]);
		const old = core.get('play');
		document.querySelector<HTMLButtonElement>('.host')?.click();
		await old.remove();
		const callback = vi.fn();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const replacement = core.get('play');
		expect(replacement).not.toBe(old);
		expect(replacement.state).not.toBe(old.state);
		expect(() => old.start()).toThrow();
		await old.remove();
		await old.stop();
		reject(new Error('late failure'));
		await Promise.resolve();
		expect(core.get('play')).toBe(replacement);
		expect(replacement.lastError).toBeUndefined();
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).toHaveBeenCalledOnce();
		await replacement.remove();
	});

	it('does not let a state subscriber failure interrupt cleanup or other subscribers', async () => {
		const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
		const core = createMakoo();
		const callback = vi.fn();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const handle = core.get('play');
		const cause = new Error('subscriber failed');
		const unsubscribe = handle.state.subscribe(() => {
			throw cause;
		});
		const statuses: string[] = [];
		handle.state.subscribe(() => {
			statuses.push(handle.state.getSnapshot().status);
		});
		await handle.remove();
		expect(statuses).toEqual(['idle']);
		expect(reported).toHaveBeenCalledWith(cause);
		expect(() => core.get('play')).toThrow();
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).not.toHaveBeenCalled();
		unsubscribe();
	});

	it('binds the first host without an adapter and exposes a stable, restartable handle', async () => {
		const callback = vi.fn();
		const declaration = listen({ name: 'play', listenAt: '.host', type: 'click', callback });
		const [first, second] = document.querySelectorAll<HTMLButtonElement>('.host');
		first.click();
		expect(callback).not.toHaveBeenCalled();
		const core = createMakoo();
		expect(core.apply([declaration])).toBeUndefined();
		const handle = core.get('play');
		expect(core.get('play')).toBe(handle);
		expect(handle.state.getSnapshot()).toEqual({ status: 'bound' });
		handle.start();
		handle.start();
		first.click();
		second.click();
		expect(callback).toHaveBeenCalledTimes(1);
		await handle.stop();
		expect(handle.state.getSnapshot()).toEqual({ status: 'idle' });
		first.click();
		expect(callback).toHaveBeenCalledTimes(1);
		handle.start();
		first.click();
		expect(callback).toHaveBeenCalledTimes(2);
		await handle.remove();
		first.click();
		expect(callback).toHaveBeenCalledTimes(2);
		expect(() => core.get('play')).toThrow();
		expect(() => handle.start()).toThrow();
	});
});
