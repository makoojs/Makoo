import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountAdapter, ObservationNotice } from '../src';
import { createMakoo, inject, listen } from '../src';

describe('core instance', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	function adapter(
		mount: MountAdapter['mount'] = () => 'handle',
		unmount: MountAdapter['unmount'] = () => {}
	): MountAdapter {
		return { name: 'plain', mount, unmount };
	}

	describe('apply', () => {
		it('registers and starts a mixed batch, each pipeline keeping its own surface', () => {
			const host = document.createElement('section');
			host.id = 'host';
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(host, play);
			const core = createMakoo();
			core.useAdapter(adapter());
			core.apply([
				inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);

			expect(core.injection('panel').statusHandle.getSnapshot()).toBe('mounted');
			const click = core.listener('click');
			expect(click.kind).toBe('listener');
			expect(click.name).toBe('click');
			expect(click.status).toBe('bound');
			expect(click.lastError).toBeUndefined();
		});

		it('starts the batch in declaration order across both pipelines', () => {
			const host = document.createElement('section');
			host.id = 'host';
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(host, play);
			const order: string[] = [];
			const originalAddEventListener = play.addEventListener.bind(play);
			vi.spyOn(play, 'addEventListener').mockImplementation((...args) => {
				order.push(`listen:${args[0]}`);
				return originalAddEventListener(...args);
			});
			const core = createMakoo();
			core.useAdapter(
				adapter(() => {
					order.push('mount');
				})
			);
			core.apply([
				listen({ name: 'first', listenAt: '#play', type: 'click', callback: vi.fn() }),
				inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
				listen({ name: 'last', listenAt: '#play', type: 'focus', callback: vi.fn() })
			]);
			expect(order).toEqual(['listen:click', 'mount', 'listen:focus']);
		});

		it('rejects the whole batch when a listener selector is invalid', () => {
			const host = document.createElement('section');
			host.id = 'host';
			document.body.append(host);
			const core = createMakoo();
			core.useAdapter(adapter());
			expect(() =>
				core.apply([
					inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
					listen({ name: 'click', listenAt: '[', type: 'click', callback: vi.fn() })
				])
			).toThrow(
				expect.objectContaining({
					code: 'MAKOO_DECLARATION_INVALID',
					message: expect.stringContaining('[')
				})
			);
			expect(() => core.injection('panel')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
			expect(() => core.listener('click')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
		});

		it('rejects duplicate names inside the batch and across pipelines', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			core.useAdapter(adapter());
			core.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			// existing listener vs new component of the same name
			expect(() =>
				core.apply([
					inject({ name: 'click', injectAt: '#play', adapter: 'plain', component: {} })
				])
			).toThrow(expect.objectContaining({ code: 'MAKOO_INJECTION_NAME_CONFLICT' }));
			// batch-internal duplicate across pipelines
			expect(() =>
				core.apply([
					inject({ name: 'dup', injectAt: '#play', adapter: 'plain', component: {} }),
					listen({ name: 'dup', listenAt: '#play', type: 'click', callback: vi.fn() })
				])
			).toThrow(expect.objectContaining({ code: 'MAKOO_INJECTION_NAME_CONFLICT' }));
			expect(() => core.injection('dup')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
		});

		it('runs the batch as a single outermost operation: mid-apply subscribers see one merged notification', () => {
			const host = document.createElement('section');
			host.id = 'host';
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(host, play);
			const notified: string[] = [];
			const core = createMakoo();
			// The component's mount runs inside the batch operation and subscribes to a later listener.
			core.useAdapter(
				adapter(() => {
					core.listener('click').subscribe(() => {
						notified.push(core.listener('click').status);
					});
				})
			);
			core.apply([
				inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			expect(notified).toEqual(['bound']);
		});
	});

	describe('lookup', () => {
		it('returns the same object on repeated lookups', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			core.apply([
				listen({
					name: 'click',
					listenAt: '#play',
					type: 'click',
					callback: vi.fn()
				})
			]);
			const byName = core.listener('click');
			expect(core.listener('click')).toBe(byName);
		});

		it('returns a fresh object after removal and re-application', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			const declaration = listen({
				name: 'click',
				listenAt: '#play',
				type: 'click',
				callback: vi.fn()
			});
			core.apply([declaration]);
			const previous = core.listener('click');
			previous.remove();
			core.apply([declaration]);
			const replacement = core.listener('click');
			expect(replacement).not.toBe(previous);
			expect(core.listener('click')).toBe(replacement);
		});

		it('throws for wrong-kind lookups', () => {
			const host = document.createElement('section');
			host.id = 'host';
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(host, play);
			const core = createMakoo();
			core.useAdapter(adapter());
			core.apply([
				inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			expect(() => core.listener('panel')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
			expect(() => core.injection('click')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
		});
	});

	describe('observe', () => {
		it('emits injection-removed when a listener is removed, even after a cleanup failure', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			core.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			vi.spyOn(play, 'removeEventListener').mockImplementation(() => {
				throw new Error('unbind failed');
			});
			const notices: ObservationNotice[] = [];
			core.observe((notice) => notices.push(notice));
			const click = core.listener('click');

			click.remove();

			// remove() frees the name regardless of the cleanup result; the residue lock guards re-apply
			expect(notices).toEqual([{ type: 'injection-removed', name: 'click' }]);
			expect(click.status).toBe('failed');
			expect(click.lastError?.code).toBe('MAKOO_INJECTION_CLEANUP_FAILED');
			expect(() => core.listener('click')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
		});

		it('emits diagnostic for a listener callback failure, tagged with the injection name', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const cause = new Error('business error');
			const core = createMakoo();
			core.apply([
				listen({
					name: 'click',
					listenAt: '#play',
					type: 'click',
					callback: () => {
						throw cause;
					}
				})
			]);
			const notices: ObservationNotice[] = [];
			core.observe((notice) => notices.push(notice));
			play.click();
			expect(notices).toEqual([
				{
					type: 'diagnostic',
					name: 'click',
					error: expect.objectContaining({
						code: 'MAKOO_LISTENER_CALLBACK_FAILED',
						cause
					})
				}
			]);
			expect(core.listener('click').status).toBe('bound');
		});

		it('emits instance-disposed after all removals, carrying an aggregate error on cleanup failure', async () => {
			const host = document.createElement('section');
			host.id = 'host';
			document.body.append(host);
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
				inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} })
			]);
			const notices: ObservationNotice[] = [];
			core.observe((notice) => notices.push(notice));
			await expect(core.dispose()).rejects.toMatchObject({
				code: 'MAKOO_INSTANCE_CLEANUP_FAILED'
			});
			expect(notices.at(-1)).toMatchObject({
				type: 'instance-disposed',
				error: expect.objectContaining({ code: 'MAKOO_INSTANCE_CLEANUP_FAILED' })
			});
		});

		it('keeps observer failures contained and does not chain diagnostics', async () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			core.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			const seen: string[] = [];
			const diagnostics: ObservationNotice[] = [];
			core.observe((notice) => {
				if (notice.type === 'injection-removed') {
					seen.push('first');
					throw new Error('observer boom');
				}
				if (notice.type === 'diagnostic') {
					seen.push('diagnostic');
					diagnostics.push(notice);
					throw new Error('diagnostic boom');
				}
			});
			core.observe((notice) => {
				if (notice.type === 'injection-removed') seen.push('second');
			});
			core.listener('click').remove();
			expect(seen).toEqual(['first', 'diagnostic', 'second']);
			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0]).toMatchObject({
				type: 'diagnostic',
				error: expect.objectContaining({
					code: 'MAKOO_INSTANCE_OBSERVER_FAILED',
					cause: expect.objectContaining({ message: 'observer boom' })
				})
			});
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({
					cause: expect.objectContaining({ message: 'diagnostic boom' })
				})
			);
		});
	});

	describe('dispose', () => {
		it('removes injections in registration order across both pipelines', async () => {
			const host = document.createElement('section');
			host.id = 'host';
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(host, play);
			const core = createMakoo();
			core.useAdapter(adapter());
			core.apply([
				listen({ name: 'first', listenAt: '#play', type: 'click', callback: vi.fn() }),
				inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
				listen({ name: 'last', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			const notices: ObservationNotice[] = [];
			core.observe((notice) => notices.push(notice));
			await core.dispose();
			expect(notices).toEqual([
				{ type: 'injection-removed', name: 'first' },
				{ type: 'injection-removed', name: 'panel' },
				{ type: 'injection-removed', name: 'last' },
				{ type: 'instance-disposed' }
			]);
		});

		it('rejects later calls once disposed and stays idempotent', async () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			core.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			const click = core.listener('click');
			const first = core.dispose();
			const second = core.dispose();
			expect(second).toBe(first);
			await first;
			expect(() => click.start()).toThrow(
				expect.objectContaining({ code: 'MAKOO_INSTANCE_DISPOSED' })
			);
			expect(() =>
				core.apply([
					listen({ name: 'later', listenAt: '#play', type: 'click', callback: vi.fn() })
				])
			).toThrow(expect.objectContaining({ code: 'MAKOO_INSTANCE_DISPOSED' }));
			expect(() => core.observe(() => {})).toThrow(
				expect.objectContaining({ code: 'MAKOO_INSTANCE_DISPOSED' })
			);
			expect(() =>
				core.useAdapter({ name: 'other', mount: () => {}, unmount: () => {} })
			).toThrow(expect.objectContaining({ code: 'MAKOO_INSTANCE_DISPOSED' }));
		});
	});

	describe('residue locks', () => {
		it('keeps residue locks inside their own instance', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			vi.spyOn(play, 'removeEventListener').mockImplementation(() => {
				throw new Error('unbind failed');
			});
			const first = createMakoo();
			const second = createMakoo();
			first.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			first.listener('click').stop();
			expect(first.listener('click').status).toBe('failed');
			// The locked element is skipped for this injection name — but only inside this instance.
			second.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			expect(second.listener('click').status).toBe('bound');
		});
	});

	describe('notifications', () => {
		it('delivers a final notification to subscribers of a removed listener', () => {
			const play = document.createElement('button');
			play.id = 'play';
			document.body.append(play);
			const core = createMakoo();
			core.apply([
				listen({ name: 'click', listenAt: '#play', type: 'click', callback: vi.fn() })
			]);
			const click = core.listener('click');
			const statuses: string[] = [];
			click.subscribe(() => statuses.push(click.status));
			click.remove();
			expect(statuses).toEqual(['idle']);
			expect(() => core.listener('click')).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_NOT_FOUND' })
			);
		});

		it('notifies in registration order when several listeners change in one delivery', async () => {
			const parent = document.createElement('div');
			const first = document.createElement('button');
			const second = document.createElement('button');
			first.className = 'host';
			second.className = 'host';
			parent.append(first, second);
			document.body.append(parent);
			const core = createMakoo();
			core.apply([
				listen({ name: 'one', listenAt: '.host', type: 'click', callback: vi.fn() }),
				listen({ name: 'two', listenAt: '.host', type: 'click', callback: vi.fn() })
			]);
			const order: string[] = [];
			core.listener('one').subscribe(() => order.push('one'));
			core.listener('two').subscribe(() => order.push('two'));
			parent.remove();
			await Promise.resolve();
			expect(order).toEqual(['one', 'two']);
		});
	});
});
