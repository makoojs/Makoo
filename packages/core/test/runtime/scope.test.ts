import { describe, expect, it, vi } from 'vitest';
import { coreErrors, MakooError } from '../../src';
import { createScope } from '../../src/runtime/scope';

const boom = (label: string) => () => {
	throw new Error(label);
};

describe('scope', () => {
	describe('stop order and aggregation', () => {
		it('stops child scopes before its own cleanups, which run in reverse order', () => {
			const order: string[] = [];
			const scope = createScope();
			scope.onCleanup(() => order.push('first'));
			scope.onCleanup(() => order.push('second'));
			const child = scope.spawn({ setup: (s) => s.onCleanup(() => order.push('child')) });
			scope.spawn({ setup: (s) => s.onCleanup(() => order.push('child2')) });

			scope.stop();

			expect(child.isEnded).toBe(true);
			expect(order).toEqual(['child', 'child2', 'second', 'first']);
		});

		it('stops a whole subtree depth-first', () => {
			const order: string[] = [];
			const scope = createScope();
			scope.onCleanup(() => order.push('root'));
			scope.spawn({
				setup: (s) => {
					s.onCleanup(() => order.push('child'));
					s.spawn({ setup: (g) => g.onCleanup(() => order.push('grandchild')) });
				}
			});

			scope.stop();

			expect(order).toEqual(['grandchild', 'child', 'root']);
		});

		it('runs every cleanup even when earlier ones throw, and collects the errors', () => {
			const scope = createScope();
			const reached = vi.fn();
			scope.onCleanup(boom('one'));
			scope.onCleanup(reached);
			scope.onCleanup(boom('two'));

			scope.stop();

			expect(reached).toHaveBeenCalled();
			expect(scope.outcome).toMatchObject({
				reason: 'stopped',
				cleanupErrors: [
					expect.objectContaining({ message: 'two' }),
					expect.objectContaining({ message: 'one' })
				]
			});
		});
	});

	describe('end reasons', () => {
		it('records a stopped outcome after stop', () => {
			const scope = createScope();
			scope.stop();
			expect(scope.outcome).toEqual({
				reason: 'stopped',
				error: undefined,
				cleanupErrors: []
			});
		});

		it('records a left outcome after leave', () => {
			const scope = createScope();
			scope.leave();
			expect(scope.outcome).toEqual({ reason: 'left', error: undefined, cleanupErrors: [] });
		});

		it('records a failed outcome with the error after fail', () => {
			const scope = createScope();
			const error = coreErrors.createRecorded('MAKOO_MOUNT_TARGET_DETACHED', { name: 'x' });
			scope.fail(error);
			expect(scope.outcome).toEqual({ reason: 'failed', error, cleanupErrors: [] });
		});

		it('fails a scope whose setup throws and still runs its cleanups', () => {
			const cleanup = vi.fn();
			const thrown = new MakooError('setup exploded', { code: 'MAKOO_X' });
			const scope = createScope();
			const child = scope.spawn({
				setup: (s) => {
					s.onCleanup(cleanup);
					throw thrown;
				}
			});

			expect(child.outcome).toMatchObject({ reason: 'failed', error: thrown });
			expect(cleanup).toHaveBeenCalled();
		});

		it('routes a setup error thrown after stopping itself to uncaughtSetupError, keeping the stopped outcome', () => {
			const thrown = new Error('uncaught setup error');
			const uncaughtSetupError = vi.fn();
			const scope = createScope();
			const child = scope.spawn({
				setup: (s) => {
					s.stop();
					throw thrown;
				},
				uncaughtSetupError
			});

			expect(child.outcome).toMatchObject({ reason: 'stopped' });
			expect(uncaughtSetupError).toHaveBeenCalledWith(thrown);
		});

		it('calls ended exactly once with the final outcome', () => {
			const ended = vi.fn();
			const scope = createScope({ ended });
			scope.leave();
			scope.stop();
			expect(ended).toHaveBeenCalledTimes(1);
			expect(ended).toHaveBeenCalledWith(
				expect.objectContaining({ reason: 'left', cleanupErrors: [] })
			);
		});
	});

	describe('idempotence and reentry', () => {
		it('ignores a second stop and a stop during cleanup', () => {
			const scope = createScope();
			scope.onCleanup(() => scope.stop());
			const cleanup = vi.fn();
			scope.onCleanup(cleanup);

			scope.stop();
			scope.stop();

			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it('runs onCleanup immediately on an ended scope', () => {
			const scope = createScope();
			scope.stop();
			const fn = vi.fn();
			scope.onCleanup(fn);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('propagates a throw from cleanup registered after the scope ended to the caller', () => {
			const scope = createScope();
			scope.stop();
			expect(() => scope.onCleanup(boom('late'))).toThrow('late');
		});

		it('returns a born-ended child without running its setup', () => {
			const scope = createScope();
			scope.stop();
			const setup = vi.fn();
			const ended = vi.fn();
			const child = scope.spawn({ setup, ended });

			expect(child.isEnded).toBe(true);
			expect(setup).not.toHaveBeenCalled();
			expect(ended).not.toHaveBeenCalled();
			const cleanup = vi.fn();
			child.onCleanup(cleanup);
			expect(cleanup).toHaveBeenCalledTimes(1);
		});
	});

	describe('supervision', () => {
		it('escalate (default): a child failure ends the parent with the same error', () => {
			const scope = createScope();
			const error = new MakooError('child failed', { code: 'MAKOO_X' });
			scope.spawn({
				setup: () => {
					throw error;
				}
			});

			expect(scope.outcome).toMatchObject({ reason: 'failed', error });
			expect(scope.isEnded).toBe(true);
		});

		it('escalate: child cleanup errors join the parent outcome', () => {
			const scope = createScope();
			scope.spawn({ setup: (s) => s.onCleanup(boom('child-cleanup')) });

			scope.stop();

			expect(scope.outcome).toMatchObject({
				reason: 'stopped',
				cleanupErrors: [expect.objectContaining({ message: 'child-cleanup' })]
			});
		});

		it('escalate: a child ending on leave with cleanup errors fails the parent', () => {
			const scope = createScope();
			const child = scope.spawn({ setup: (s) => s.onCleanup(boom('residue')) });
			child.leave();

			expect(scope.outcome).toMatchObject({
				reason: 'failed',
				cleanupErrors: [expect.objectContaining({ message: 'residue' })]
			});
		});

		it('isolate: a failing child leaves the parent running and still reports its outcome', () => {
			const scope = createScope();
			const ended = vi.fn();
			const child = scope.spawn({
				supervision: 'isolate',
				setup: () => {
					throw new MakooError('alone', { code: 'MAKOO_X' });
				},
				ended
			});

			expect(child.outcome?.reason).toBe('failed');
			expect(ended).toHaveBeenCalled();
			expect(scope.isEnded).toBe(false);
			expect(scope.outcome).toBeUndefined();
		});

		it('isolate: child cleanup errors stay out of the parent outcome', () => {
			const scope = createScope();
			scope.spawn({
				supervision: 'isolate',
				setup: (s) => s.onCleanup(boom('child-cleanup'))
			});
			scope.stop();

			expect(scope.outcome?.cleanupErrors).toEqual([]);
		});

		it('merges errors passed to addCleanupErrors during teardown into the outcome', () => {
			const scope = createScope();
			scope.spawn({
				supervision: 'isolate',
				setup: (s) => s.onCleanup(boom('child-cleanup'))
			});
			// match merges child cleanup errors collected during group teardown into the host outcome
			scope.onCleanup(() => scope.addCleanupErrors([new Error('child-cleanup')]));

			scope.stop();

			expect(scope.outcome?.cleanupErrors).toHaveLength(1);
		});
	});

	describe('in-operation tracking', () => {
		it('reports the tree as busy while setup or teardown is running', () => {
			const seen: boolean[] = [];
			const scope = createScope();
			scope.spawn({
				setup: (s) => {
					seen.push(scope.isTransitioning);
					s.onCleanup(() => seen.push(scope.isTransitioning));
				}
			});
			seen.push(scope.isTransitioning);
			scope.stop();
			seen.push(scope.isTransitioning);

			// Order: inside setup → after spawn → during stop's cleanup → after stop
			expect(seen).toEqual([true, false, true, false]);
		});
	});
});
