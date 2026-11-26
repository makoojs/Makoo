import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MakooError } from '../../src';
import {
	type Appearance,
	DEFAULT_MATCH_TIMEOUT,
	type MatchContext,
	match
} from '../../src/runtime/match';
import { createDomObserver } from '../../src/runtime/observer';
import { createScope, type Scope } from '../../src/runtime/scope';

const live: Scope[] = [];

function createTestBed() {
	const operation = <T>(run: () => T): T => run();
	const locks = new WeakSet<Element>();
	const context: MatchContext = {
		observer: createDomObserver(operation),
		operation,
		changed: vi.fn(),
		isLocked: (el) => locks.has(el),
		lock: (el) => locks.add(el)
	};
	const scope = createScope();
	live.push(scope);
	return { scope, context, locks };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

const lastError = (scope: Scope) => scope.outcome?.error as MakooError;

describe('match', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		for (const scope of live.splice(0)) scope.stop();
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	describe('first mode', () => {
		const first = {
			mode: 'first' as const,
			name: 'mount',
			detachedCode: 'MAKOO_MOUNT_TARGET_DETACHED' as const
		};

		it('runs setup synchronously on an already-connected element', () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			const setup = vi.fn();
			const handle = match(scope, '.t', first, context, setup);

			expect(setup).toHaveBeenCalledTimes(1);
			expect(setup.mock.calls[0][0]).toBe(document.querySelector('.t'));
			expect(handle.appearances()).toEqual([document.querySelector('.t')]);
		});

		it('waits for an element to appear, then mounts it', async () => {
			const { scope, context } = createTestBed();
			const setup = vi.fn();
			const handle = match(scope, '.t', { ...first, timeout: 5000 }, context, setup);

			expect(setup).not.toHaveBeenCalled();
			document.body.innerHTML = '<div class="t"></div>';
			await flush();

			expect(setup).toHaveBeenCalledTimes(1);
			expect(handle.appearances()).toHaveLength(1);
		});

		it('fails the scope with TARGET_WAIT_TIMEOUT after the timeout', async () => {
			const { scope, context } = createTestBed();
			match(scope, '.t', { ...first, timeout: 1000 }, context, vi.fn());

			await vi.advanceTimersByTimeAsync(1000);

			expect(scope.outcome?.reason).toBe('failed');
			expect(lastError(scope).code).toBe('MAKOO_TARGET_WAIT_TIMEOUT');
			expect(lastError(scope).details).toMatchObject({
				name: 'mount',
				selector: '.t',
				timeout: 1000
			});
		});

		it('does not restart the timeout on unrelated mutations while waiting', async () => {
			const { scope, context } = createTestBed();
			match(scope, '.t', { ...first, timeout: 1000 }, context, vi.fn());

			await vi.advanceTimersByTimeAsync(800);
			document.body.insertAdjacentHTML('beforeend', '<div class="u"></div>');
			await vi.advanceTimersByTimeAsync(199);
			expect(scope.isEnded).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			expect(lastError(scope).code).toBe('MAKOO_TARGET_WAIT_TIMEOUT');
		});

		it('uses the default timeout when none is given', async () => {
			const { scope, context } = createTestBed();
			match(scope, '.t', first, context, vi.fn());
			await vi.advanceTimersByTimeAsync(DEFAULT_MATCH_TIMEOUT);
			expect(lastError(scope).code).toBe('MAKOO_TARGET_WAIT_TIMEOUT');
		});

		it('fails with the detached error when the element leaves without reinject', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			match(scope, '.t', first, context, vi.fn());

			document.querySelector('.t')?.remove();
			await flush();

			expect(scope.outcome?.reason).toBe('failed');
			expect(lastError(scope).code).toBe('MAKOO_MOUNT_TARGET_DETACHED');
		});

		it('reinjects after leave and restarts the timeout each round', async () => {
			const { scope, context } = createTestBed();
			const setup = vi.fn();
			const handle = match(
				scope,
				'.t',
				{ ...first, reinject: true, timeout: 1000 },
				context,
				setup
			);

			document.body.innerHTML = '<div class="t">one</div>';
			await flush();
			expect(setup).toHaveBeenCalledTimes(1);

			// First round leaves → wait restarts; the clock starts from zero
			document.querySelector('.t')?.remove();
			await flush();
			expect(scope.isEnded).toBe(false);
			expect(handle.appearances()).toHaveLength(0);

			await vi.advanceTimersByTimeAsync(999);
			expect(scope.isEnded).toBe(false);

			document.body.innerHTML = '<div class="t">two</div>';
			await flush();
			expect(setup).toHaveBeenCalledTimes(2);
			expect(setup.mock.calls[1][0]).not.toBe(setup.mock.calls[0][0]);
		});

		it('fails when a reinject round exceeds its timeout', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			match(scope, '.t', { ...first, reinject: true, timeout: 500 }, context, vi.fn());
			expect(scope.outcome).toBeUndefined();

			document.querySelector('.t')?.remove();
			await flush();
			await vi.advanceTimersByTimeAsync(500);

			expect(lastError(scope).code).toBe('MAKOO_TARGET_WAIT_TIMEOUT');
		});

		it('locks the element and fails instead of reinjecting after a cleanup failure', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context, locks } = createTestBed();
			const el = document.querySelector('.t') as Element;
			match(scope, '.t', { ...first, reinject: true }, context, (_el, api) => {
				api.onCleanup(() => {
					throw new Error('unmount failed');
				});
			});

			el.remove();
			await flush();

			expect(locks.has(el)).toBe(true);
			expect(scope.outcome).toMatchObject({
				reason: 'failed',
				cleanupErrors: [expect.objectContaining({ message: 'unmount failed' })]
			});

			// The residue lock prevents the same element from being mounted again
			document.body.appendChild(el);
			await flush();
			expect(scope.isEnded).toBe(true);
		});

		it('skips residue-locked elements and reports the skipped count on timeout', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context, locks } = createTestBed();
			locks.add(document.querySelector('.t') as Element);
			const setup = vi.fn();
			match(scope, '.t', { ...first, timeout: 500 }, context, setup);

			await vi.advanceTimersByTimeAsync(500);

			expect(setup).not.toHaveBeenCalled();
			expect(lastError(scope).details).toMatchObject({ lockedSkipped: 1 });
		});

		it('supports the listener detached code', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			match(
				scope,
				'.t',
				{ mode: 'first', name: 'l', detachedCode: 'MAKOO_LISTENER_TARGET_DETACHED' },
				context,
				vi.fn()
			);

			document.querySelector('.t')?.remove();
			await flush();

			expect(lastError(scope).code).toBe('MAKOO_LISTENER_TARGET_DETACHED');
		});

		it('stops matching once its scope is stopped', async () => {
			const { scope, context } = createTestBed();
			const setup = vi.fn();
			match(scope, '.t', { ...first, timeout: 5000 }, context, setup);
			scope.stop();

			document.body.innerHTML = '<div class="t"></div>';
			await flush();
			await vi.advanceTimersByTimeAsync(5000);

			expect(setup).not.toHaveBeenCalled();
		});
	});

	describe('all mode', () => {
		it('collects every matching element in document order', () => {
			document.body.innerHTML =
				'<i class="t">a</i><b><i class="t">b</i></b><i class="t">c</i>';
			const { scope, context } = createTestBed();
			const setup = vi.fn();
			const handle = match(scope, 'i.t', { mode: 'all' }, context, setup);

			expect(setup).toHaveBeenCalledTimes(3);
			expect(handle.appearances()).toEqual([...document.querySelectorAll('i.t')]);
		});

		it('collects elements appearing later without remounting known ones', async () => {
			document.body.innerHTML = '<div class="t">a</div>';
			const { scope, context } = createTestBed();
			const setup = vi.fn();
			match(scope, '.t', { mode: 'all' }, context, setup);

			document.body.insertAdjacentHTML('beforeend', '<div class="t">b</div>');
			await flush();

			expect(setup).toHaveBeenCalledTimes(2);
			expect(setup.mock.calls[1][0].textContent).toBe('b');
		});

		it('keeps an element whose setup failed from remounting until it leaves', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			const el = document.querySelector('.t') as Element;
			const setup = vi.fn(() => {
				throw new Error('mount exploded');
			});
			const ended = vi.fn();
			match(scope, '.t', { mode: 'all', ended }, context, setup);

			// isolate: the host scope is unaffected
			expect(scope.isEnded).toBe(false);
			expect(ended).toHaveBeenCalledWith(el, expect.objectContaining({ reason: 'failed' }));

			// The element is still in the DOM: later scans do not retry it
			document.body.insertAdjacentHTML('beforeend', '<div class="t">b</div>');
			await flush();
			expect(setup).toHaveBeenCalledTimes(2);
			expect(setup).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ textContent: 'b' }),
				expect.anything()
			);

			// Failed element leaves → entry removed → re-adding it can remount
			el.remove();
			await flush();
			document.body.appendChild(el);
			await flush();
			expect(setup).toHaveBeenCalledTimes(3);
			expect(setup).toHaveBeenNthCalledWith(3, el, expect.anything());
		});

		it('ends an appearance when its element leaves and remounts on return', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			const el = document.querySelector('.t') as Element;
			const ended = vi.fn();
			const handle = match(scope, '.t', { mode: 'all', ended }, context, vi.fn());

			el.remove();
			await flush();
			expect(ended).toHaveBeenCalledWith(el, expect.objectContaining({ reason: 'left' }));
			expect(handle.appearances()).toHaveLength(0);

			document.body.appendChild(el);
			await flush();
			expect(handle.appearances()).toEqual([el]);
		});

		it('remounts on the next scan when leave() is called but the element still matches', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			let api: Appearance | undefined;
			const setup = vi.fn((_el: Element, appearance: Appearance) => {
				api = appearance;
			});
			const handle = match(scope, '.t', { mode: 'all' }, context, setup);

			api?.leave();
			expect(handle.appearances()).toHaveLength(0);

			document.body.insertAdjacentHTML('beforeend', '<div class="u"></div>');
			await flush();
			expect(setup).toHaveBeenCalledTimes(2);
			expect(handle.appearances()).toHaveLength(1);
		});

		it('never remounts an element whose appearance was stopped', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			let api: Appearance | undefined;
			const setup = vi.fn((_el: Element, appearance: Appearance) => {
				api = appearance;
			});
			match(scope, '.t', { mode: 'all' }, context, setup);

			api?.stop();
			expect(api?.isEnded).toBe(true);

			document.body.insertAdjacentHTML('beforeend', '<div class="u"></div>');
			await flush();
			expect(setup).toHaveBeenCalledTimes(1);
			expect(scope.isEnded).toBe(false);
		});

		it('skips residue-locked elements', async () => {
			document.body.innerHTML = '<div class="t">a</div><div class="t">b</div>';
			const { scope, context, locks } = createTestBed();
			locks.add(document.querySelectorAll('.t')[0]);
			const setup = vi.fn();
			match(scope, '.t', { mode: 'all' }, context, setup);

			expect(setup).toHaveBeenCalledTimes(1);
			expect(setup.mock.calls[0][0].textContent).toBe('b');
		});

		it('never matches elements inside an excluded container', async () => {
			document.body.innerHTML = '<div class="t"><div class="t"></div></div>';
			const { scope, context } = createTestBed();
			const setup = vi.fn((el: Element, api: Appearance) => {
				api.exclude(el);
			});
			const handle = match(scope, '.t', { mode: 'all' }, context, setup);

			// The outer mount excludes its own container → nested elements inside are never matched
			expect(setup).toHaveBeenCalledTimes(1);
			expect(handle.appearances()).toEqual([document.querySelector('.t')]);

			document.body.insertAdjacentHTML(
				'beforeend',
				'<div class="t"><div class="t"></div></div>'
			);
			await flush();
			expect(setup).toHaveBeenCalledTimes(2);
		});

		it('locks the element and isolates mid-flight cleanup failures', async () => {
			document.body.innerHTML = '<div class="t">a</div><div class="t">b</div>';
			const { scope, context, locks } = createTestBed();
			const [a] = document.querySelectorAll('.t');
			let apiA: Appearance | undefined;
			match(scope, '.t', { mode: 'all' }, context, (el, api) => {
				if (el === a) {
					apiA = api;
					api.onCleanup(() => {
						throw new Error('child cleanup failed');
					});
				}
			});

			apiA?.stop();

			expect(locks.has(a)).toBe(true);
			expect(scope.isEnded).toBe(false);
			scope.stop();
			expect(scope.outcome?.cleanupErrors).toEqual([]);
		});

		it('folds child cleanup errors into the group outcome during teardown', () => {
			document.body.innerHTML = '<div class="t">a</div><div class="t">b</div>';
			const { scope, context } = createTestBed();
			match(scope, '.t', { mode: 'all' }, context, (el, api) => {
				if (el.textContent === 'a')
					api.onCleanup(() => {
						throw new Error('child cleanup failed');
					});
			});

			scope.stop();

			expect(scope.outcome?.cleanupErrors).toEqual([
				expect.objectContaining({ message: 'child cleanup failed' })
			]);
		});
	});

	describe('bookkeeping', () => {
		it('fires changed when appearances come and go', async () => {
			document.body.innerHTML = '<div class="t"></div>';
			const { scope, context } = createTestBed();
			match(scope, '.t', { mode: 'all' }, context, vi.fn());
			expect(context.changed).toHaveBeenCalledTimes(1);

			document.querySelector('.t')?.remove();
			await flush();
			expect(context.changed).toHaveBeenCalledTimes(2);
		});

		it('ends every appearance when the host scope is stopped', () => {
			document.body.innerHTML = '<div class="t">a</div><div class="t">b</div>';
			const { scope, context } = createTestBed();
			const ended = vi.fn();
			match(scope, '.t', { mode: 'all', ended }, context, vi.fn());

			scope.stop();

			expect(ended).toHaveBeenCalledTimes(2);
			for (const [, outcome] of ended.mock.calls) {
				expect(outcome.reason).toBe('stopped');
			}
		});
	});
});
