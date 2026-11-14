import { afterEach, describe, expect, it, vi } from 'vitest';
import { coreErrors, type MakooError } from '../../src';
import {
	createInjectionShell,
	createOperationContext,
	type InjectionKind,
	type InternalShell,
	type SetupContext,
	type ShellHost
} from '../../src/runtime/injection';
import { createDomObserver } from '../../src/runtime/observer';
import type { Scope } from '../../src/runtime/scope';

function createHarness() {
	const registered: InternalShell[] = [];
	const removedShells: InternalShell[] = [];
	const diagnostics: MakooError[] = [];
	const open = { value: true };
	const ops = createOperationContext({
		values: () => registered.filter((s) => !removedShells.includes(s)),
		delete: (shell) => removedShells.push(shell)
	});
	const locks = new WeakSet<Element>();
	const host: ShellHost = {
		...ops,
		observer: createDomObserver(ops.operation),
		assertOpen: () => {
			if (!open.value) throw coreErrors.createThrowable('MAKOO_INSTANCE_DISPOSED');
		},
		locks: () => ({ isLocked: (el) => locks.has(el), lock: (el) => locks.add(el) }),
		diagnostic: (error) => diagnostics.push(error)
	};
	const spawn = <D>(declaration: D, kind: InjectionKind<D>, name: string) => {
		const shell = createInjectionShell(declaration, kind, name, host);
		registered.push(shell);
		return shell;
	};
	return { host, ops, spawn, registered, removedShells, diagnostics, open, locks };
}

/** Fake injection kind: `live` is controlled by an external flag; extra setup behavior can be injected. */
function fakeKind(active: 'mounted' | 'bound' | 'collecting' = 'mounted') {
	const state = { live: false };
	const hooks = {
		setup: undefined as undefined | ((scope: Scope, context: SetupContext) => void),
		cleanups: [] as (() => void)[]
	};
	const kind: InjectionKind = {
		kind: 'test',
		active,
		setup: (scope, _declaration, context) => {
			context.expose({ live: () => state.live });
			for (const fn of hooks.cleanups) scope.onCleanup(fn);
			hooks.setup?.(scope, context);
		}
	};
	return { kind, state, hooks };
}

// The changed signal goes through the shell's dirty: simulates match's facts changing
const markChanged = (shell: InternalShell, host: ShellHost) =>
	host.operation(() => host.dirty(shell));

describe('injection shell', () => {
	let consoleError: { mockRestore(): unknown } | undefined;
	afterEach(() => {
		consoleError?.mockRestore();
		consoleError = undefined;
	});

	describe('commands', () => {
		it('starts idle, runs setup on start, and ignores start while running', () => {
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const setup = vi.fn();
			hooks.setup = setup;
			const shell = harness.spawn('d', kind, 'a');

			expect(shell.status).toBe('idle');
			expect(shell.lastError).toBeUndefined();
			shell.start();
			shell.start();
			expect(setup).toHaveBeenCalledTimes(1);
		});

		it('derives waiting while live() is false and the active word once live', () => {
			const harness = createHarness();
			const { kind, state } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');

			shell.start();
			expect(shell.status).toBe('waiting');

			state.live = true;
			markChanged(shell, harness.host);
			expect(shell.status).toBe('mounted');
		});

		it('returns the collecting word while running regardless of live', () => {
			const harness = createHarness();
			const { kind } = fakeKind('collecting');
			const shell = harness.spawn('d', kind, 'group');

			shell.start();
			expect(shell.status).toBe('collecting');
		});

		it('records a setup failure as failed with the thrown error as lastError', () => {
			consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const thrown = coreErrors.createRecorded('MAKOO_MOUNT_FAILED', { name: 'a' });
			hooks.setup = () => {
				throw thrown;
			};
			const shell = harness.spawn('d', kind, 'a');

			shell.start();

			expect(shell.status).toBe('failed');
			expect(shell.lastError).toBe(thrown);
			expect(consoleError).toHaveBeenCalledWith(thrown);
		});

		it('aggregates cleanup failures into INJECTION_CLEANUP_FAILED', () => {
			consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const failure = new Error('unmount failed');
			const later = new Error('second cleanup failed');
			hooks.cleanups = [
				() => {
					throw failure;
				},
				() => {
					throw later;
				}
			];
			const shell = harness.spawn('d', kind, 'a');

			shell.start();
			shell.stop();

			expect(shell.status).toBe('failed');
			expect(shell.lastError?.code).toBe('MAKOO_INJECTION_CLEANUP_FAILED');
			// Cleanup errors enter `errors` in the order they occur (the cleanups themselves run in reverse order)
			expect(shell.lastError?.errors).toEqual([later, failure]);
		});

		it('keeps lastError after stopping a failed injection and clears it on restart', () => {
			consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			hooks.cleanups = [
				() => {
					throw new Error('boom');
				}
			];
			const shell = harness.spawn('d', kind, 'a');

			shell.start();
			shell.stop();
			expect(shell.status).toBe('failed'); // a cleanup failure mid-stop → failed
			const kept = shell.lastError;

			shell.stop(); // stop on an already failed injection: consumes the outcome → idle, lastError kept
			expect(shell.status).toBe('idle');
			expect(shell.lastError).toBe(kept);

			hooks.cleanups = [];
			shell.start();
			expect(shell.status).toBe('waiting');
			expect(shell.lastError).toBeUndefined();
		});

		it('makes remove idempotent and rejects start after removal', () => {
			const harness = createHarness();
			const { kind } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');

			shell.start();
			shell.remove();
			shell.remove();

			expect(shell.removed).toBe(true);
			expect(harness.removedShells).toEqual([shell]);
			expect(() => shell.start()).toThrow(
				expect.objectContaining({ code: 'MAKOO_INJECTION_REMOVED' })
			);
		});

		it('rejects start when the instance is closed', () => {
			const harness = createHarness();
			harness.open.value = false;
			const shell = harness.spawn('d', fakeKind().kind, 'a');
			expect(() => shell.start()).toThrow(
				expect.objectContaining({ code: 'MAKOO_INSTANCE_DISPOSED' })
			);
		});
	});

	describe('reentrancy', () => {
		it('runs a cross-injection start immediately even mid-operation', () => {
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const a = harness.spawn('d', kind, 'a');
			const { kind: kindB, hooks: hooksB } = fakeKind();
			const b = harness.spawn('d', kindB, 'b');

			// The busy flag is per injection: calling B.start() during A's setup runs immediately since B is not transitioning
			const order: string[] = [];
			hooks.setup = () => {
				a.subscribe(() => order.push('notify'));
				b.start();
				order.push('after-start');
			};
			hooksB.setup = () => order.push('b-setup');

			a.start();

			expect(order).toEqual(['b-setup', 'after-start', 'notify']);
		});

		it('treats a start inside own setup as already satisfied', () => {
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const setup = vi.fn();
			hooks.setup = setup;
			const shell = harness.spawn('d', kind, 'a');
			hooks.setup = (scope) => {
				setup(scope);
				shell.start(); // this injection is mid-transition → only sets the flag; the scope is already live, so the deferred start is a no-op
			};

			shell.start();
			expect(setup).toHaveBeenCalledTimes(1);
			expect(shell.status).toBe('waiting');
		});

		it('lets the stop() command during setup end the scope as stopped', () => {
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');
			hooks.setup = () => shell.stop();

			shell.start();
			expect(shell.status).toBe('idle');
		});

		it('restarts a deferred start after a clean teardown', () => {
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const setup = vi.fn();
			hooks.setup = setup;
			const shell = harness.spawn('d', kind, 'a');
			// A start() during cleanup (e.g. a restart inside an unmount hook) is registered as a deferred start
			hooks.cleanups = [() => shell.start()];

			shell.start();
			shell.stop();

			expect(setup).toHaveBeenCalledTimes(2);
			expect(shell.status).toBe('waiting');
		});

		it('drops a deferred start when the injection is removed during teardown', () => {
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const setup = vi.fn();
			hooks.setup = setup;
			const shell = harness.spawn('d', kind, 'a');
			hooks.cleanups = [
				() => {
					shell.start();
					shell.remove();
				}
			];

			shell.start();
			shell.stop();

			expect(setup).toHaveBeenCalledTimes(1);
			expect(shell.removed).toBe(true);
			expect(shell.status).toBe('idle');
		});

		it('voids a deferred start when the teardown failed, staying failed', () => {
			consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const harness = createHarness();
			const { kind, hooks } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');
			hooks.cleanups = [
				() => shell.start(),
				() => {
					throw new Error('cleanup boom');
				}
			];

			shell.start();
			shell.stop();

			expect(shell.status).toBe('failed');
			expect(shell.lastError?.code).toBe('MAKOO_INJECTION_CLEANUP_FAILED');
		});

		it('runs a subscriber-issued command immediately as a new outermost operation', () => {
			const harness = createHarness();
			const { kind } = fakeKind();
			const a = harness.spawn('d', kind, 'a');
			const { kind: kindB, hooks: hooksB } = fakeKind();
			const b = harness.spawn('d', kindB, 'b');

			const order: string[] = [];
			hooksB.setup = () => order.push('b-setup');
			a.subscribe(() => {
				order.push('a-notify');
				b.start();
			});
			b.subscribe(() => order.push('b-notify'));

			a.start();

			// Subscribers run at depth 0: their commands are new outermost operations that run immediately, with merged notifications following as usual
			expect(order).toEqual(['a-notify', 'b-setup', 'b-notify']);
		});
	});

	describe('notifications', () => {
		it('notifies subscribers once per change with merged final state', () => {
			const harness = createHarness();
			const { kind, state } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');
			const seen: string[] = [];
			shell.subscribe(() => seen.push(shell.status));

			shell.start();
			state.live = true;
			markChanged(shell, harness.host);

			expect(seen).toEqual(['waiting', 'mounted']);
		});

		it('notifies in registration order when several shells change in one operation', () => {
			const harness = createHarness();
			const { kind } = fakeKind();
			const a = harness.spawn('d', kind, 'a');
			const b = harness.spawn('d', kind, 'b');
			const order: string[] = [];
			a.subscribe(() => order.push('a'));
			b.subscribe(() => order.push('b'));

			harness.host.operation(() => {
				a.start();
				b.start();
			});

			expect(order).toEqual(['a', 'b']);
		});

		it('keeps notifying other subscribers when one throws and emits a diagnostic', () => {
			consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const harness = createHarness();
			const { kind } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');
			const reached = vi.fn();
			shell.subscribe(() => {
				throw new Error('subscriber exploded');
			});
			shell.subscribe(reached);

			shell.start();

			expect(reached).toHaveBeenCalledTimes(1);
			expect(harness.diagnostics).toEqual([
				expect.objectContaining({ code: 'MAKOO_STATE_SUBSCRIBER_FAILED' })
			]);
		});

		it('delivers a final notification to a removed shell after it leaves the registry', () => {
			const harness = createHarness();
			const { kind } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');
			shell.start();
			const seen: string[] = [];
			shell.subscribe(() => seen.push(shell.status));

			shell.remove();

			expect(harness.removedShells).toEqual([shell]);
			expect(seen).toEqual(['idle']);
		});

		it('stops notifying after unsubscribe', () => {
			const harness = createHarness();
			const { kind } = fakeKind();
			const shell = harness.spawn('d', kind, 'a');
			const fn = vi.fn();
			const off = shell.subscribe(fn);
			shell.start();
			off();
			shell.stop();
			expect(fn).toHaveBeenCalledTimes(1);
		});
	});
});
