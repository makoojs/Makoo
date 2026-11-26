import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakoo, listen } from '../src';

describe('standalone host listeners', () => {
	beforeEach(() => {
		document.body.innerHTML = '<button class="host"></button><button class="host"></button>';
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('declares without a document and copies the input at declaration time', () => {
		const callback = vi.fn();
		const replacement = vi.fn();
		const input = { name: 'play', listenAt: '.host', type: 'click', callback, capture: false };
		vi.stubGlobal('document', undefined);
		const declaration = listen(input);
		vi.unstubAllGlobals();
		input.callback = replacement;
		const core = createMakoo();
		core.apply([declaration]);
		const handle = core.listener('play');
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).toHaveBeenCalledOnce();
		expect(replacement).not.toHaveBeenCalled();
		expect(core.listener('play')).toBe(handle);
		handle.remove();
		expect(() => core.listener('play')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);
	});

	it('rejects duplicate and occupied names without disturbing accepted listeners', () => {
		const core = createMakoo();
		const callback = vi.fn();
		const declaration = listen({ name: 'play', listenAt: '.host', type: 'click', callback });
		expect(() => core.apply([declaration, declaration])).toThrow(
			expect.objectContaining({
				code: 'MAKOO_INJECTION_NAME_CONFLICT',
				message: expect.stringContaining('play')
			})
		);
		expect(() => core.listener('play')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);
		core.apply([declaration]);
		const original = core.listener('play');
		expect(() => core.apply([{ ...declaration, name: 'new' }, declaration])).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NAME_CONFLICT' })
		);
		expect(() => core.listener('new')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);
		expect(core.listener('play')).toBe(original);
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).toHaveBeenCalledOnce();
		original.remove();
	});

	it('publishes merged status changes to subscribers', () => {
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const handle = core.listener('play');
		const statuses: string[] = [];
		const unsubscribe = handle.subscribe(() => {
			statuses.push(handle.status);
		});
		expect(handle.status).toBe('bound');
		handle.stop();
		expect(handle.status).toBe('idle');
		handle.stop();
		handle.start();
		expect(statuses).toEqual(['idle', 'bound']);
		unsubscribe();
		handle.remove();
		expect(statuses).toEqual(['idle', 'bound']);
	});

	it.each([
		'throw',
		'reject'
	] as const)('reports a handler %s as a diagnostic without touching status or lastError', async (mode) => {
		const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
		const diagnostics: { name?: string; code?: string; cause?: unknown }[] = [];
		const cause = new Error('business error');
		const callback = vi.fn(() => {
			if (mode === 'throw') throw cause;
			return Promise.reject(cause);
		});
		const core = createMakoo();
		core.observe((notice) => {
			if (notice.type === 'diagnostic')
				diagnostics.push({
					name: notice.name,
					code: notice.error.code,
					cause: notice.error.cause
				});
		});
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const handle = core.listener('play');
		const button = document.querySelector<HTMLButtonElement>('.host');
		button?.click();
		await Promise.resolve();
		expect(handle.status).toBe('bound');
		expect(handle.lastError).toBeUndefined();
		expect(diagnostics).toEqual([
			{
				name: 'play',
				code: 'MAKOO_LISTENER_CALLBACK_FAILED',
				cause
			}
		]);
		expect(reported).toHaveBeenCalledWith(
			expect.objectContaining({ code: 'MAKOO_LISTENER_CALLBACK_FAILED', cause })
		);
		button?.click();
		await Promise.resolve();
		expect(callback).toHaveBeenCalledTimes(2);
		handle.remove();
	});

	it('keeps a non-error callback cause on the diagnostic', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const diagnostics: { cause?: unknown }[] = [];
		const core = createMakoo();
		core.observe((notice) => {
			if (notice.type === 'diagnostic') diagnostics.push({ cause: notice.error.cause });
		});
		core.apply([
			listen({
				name: 'play',
				listenAt: '.host',
				type: 'click',
				callback() {
					throw 'raw';
				}
			})
		]);
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(diagnostics).toEqual([{ cause: 'raw' }]);
		core.listener('play').remove();
	});

	it('isolates a binding failure from other listeners in the same batch', () => {
		const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
		const core = createMakoo();
		const [first, second] = document.querySelectorAll<HTMLButtonElement>('.host');
		first.id = 'broken';
		second.id = 'healthy';
		const cause = new Error('binding denied');
		vi.spyOn(first, 'addEventListener').mockImplementation(() => {
			throw cause;
		});
		const callback = vi.fn();
		core.apply([
			listen({ name: 'broken', listenAt: '#broken', type: 'click', callback }),
			listen({ name: 'healthy', listenAt: '#healthy', type: 'click', callback })
		]);
		const broken = core.listener('broken');
		expect(broken.status).toBe('failed');
		expect(broken.lastError).toMatchObject({
			code: 'MAKOO_LISTENER_BIND_FAILED',
			cause,
			message: expect.stringContaining('broken')
		});
		expect(reported).toHaveBeenCalledWith(broken.lastError);
		second.click();
		expect(callback).toHaveBeenCalledOnce();
		broken.stop();
		second.click();
		expect(callback).toHaveBeenCalledTimes(2);
		vi.restoreAllMocks();
		broken.start();
		expect(broken.status).toBe('bound');
		expect(broken.lastError).toBeUndefined();
		first.click();
		expect(callback).toHaveBeenCalledTimes(3);
		broken.remove();
		core.listener('healthy').remove();
	});

	it('uses the declared event and capture phase and supplies the real host as this', () => {
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
		core.listener('capture').stop();
		child.dispatchEvent(new Event('custom'));
		expect(seen).toEqual(['host', 'child', 'child']);
		core.listener('capture').remove();
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
		const old = core.listener('play');
		document.querySelector<HTMLButtonElement>('.host')?.click();
		old.remove();
		const callback = vi.fn();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const replacement = core.listener('play');
		expect(replacement).not.toBe(old);
		expect(() => old.start()).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_REMOVED' })
		);
		old.remove();
		old.stop();
		reject(new Error('late failure'));
		await Promise.resolve();
		expect(core.listener('play')).toBe(replacement);
		expect(replacement.lastError).toBeUndefined();
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).toHaveBeenCalledOnce();
		replacement.remove();
	});

	it('does not let a subscriber failure interrupt cleanup or other subscribers', () => {
		const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
		const diagnostics: { code?: string; cause?: unknown }[] = [];
		const core = createMakoo();
		const callback = vi.fn();
		core.observe((notice) => {
			if (notice.type === 'diagnostic')
				diagnostics.push({ code: notice.error.code, cause: notice.error.cause });
		});
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback })]);
		const handle = core.listener('play');
		const cause = new Error('subscriber failed');
		const unsubscribe = handle.subscribe(() => {
			throw cause;
		});
		const statuses: string[] = [];
		handle.subscribe(() => {
			statuses.push(handle.status);
		});
		handle.remove();
		expect(statuses).toEqual(['idle']);
		expect(diagnostics).toEqual([{ code: 'MAKOO_STATE_SUBSCRIBER_FAILED', cause }]);
		expect(reported).toHaveBeenCalledWith(
			expect.objectContaining({ code: 'MAKOO_STATE_SUBSCRIBER_FAILED' })
		);
		expect(() => core.listener('play')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);
		document.querySelector<HTMLButtonElement>('.host')?.click();
		expect(callback).not.toHaveBeenCalled();
		unsubscribe();
	});

	it('binds the first host only and exposes a stable, restartable handle', () => {
		const callback = vi.fn();
		const declaration = listen({ name: 'play', listenAt: '.host', type: 'click', callback });
		const [first, second] = document.querySelectorAll<HTMLButtonElement>('.host');
		first.click();
		expect(callback).not.toHaveBeenCalled();
		const core = createMakoo();
		expect(core.apply([declaration])).toBeUndefined();
		const handle = core.listener('play');
		expect(core.listener('play')).toBe(handle);
		expect(handle.status).toBe('bound');
		handle.start();
		handle.start();
		first.click();
		second.click();
		expect(callback).toHaveBeenCalledTimes(1);
		handle.stop();
		expect(handle.status).toBe('idle');
		first.click();
		expect(callback).toHaveBeenCalledTimes(1);
		handle.start();
		first.click();
		expect(callback).toHaveBeenCalledTimes(2);
		handle.remove();
		first.click();
		expect(callback).toHaveBeenCalledTimes(2);
		expect(() => core.listener('play')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);
		expect(() => handle.start()).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_REMOVED' })
		);
	});

	it('unregisters a stopped listener as soon as it is removed', () => {
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback() {} })]);
		const handle = core.listener('play');
		handle.stop();
		expect(handle.remove()).toBeUndefined();
		expect(() => core.listener('play')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);
		expect(handle.stop()).toBeUndefined();
		expect(handle.remove()).toBeUndefined();
	});

	it('frees the name when remove() fails to unbind; a re-apply skips the residue-locked host', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const [first, second] = document.querySelectorAll<HTMLButtonElement>('.host');
		const stale = vi.fn();
		const core = createMakoo();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback: stale })]);
		const handle = core.listener('play');
		vi.spyOn(first, 'removeEventListener').mockImplementation(() => {
			throw new Error('unbind failed');
		});

		handle.remove();

		expect(handle.status).toBe('failed');
		expect(handle.lastError?.code).toBe('MAKOO_INJECTION_CLEANUP_FAILED');
		expect(() => core.listener('play')).toThrow(
			expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
		);

		// Same name, same code: the new listener inherits the lock and binds the next host instead
		const fresh = vi.fn();
		core.apply([listen({ name: 'play', listenAt: '.host', type: 'click', callback: fresh })]);
		expect(core.listener('play').status).toBe('bound');
		first.click();
		second.click();
		expect(stale).toHaveBeenCalledOnce(); // the residue: the unremovable handler on the first host
		expect(fresh).toHaveBeenCalledOnce(); // bound to the second host only, never stacked on the first
		consoleError.mockRestore();
	});
});
