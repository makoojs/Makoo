import { describe, expect, it, vi } from 'vitest';
import { MakooError } from '../src/error/MakooError';
import { createObserverHub } from '../src/hooks/ObserverHub';
import type { ObserveEvent } from '../src/hooks/types';

const makeEvent = (name: ObserveEvent['name']): ObserveEvent => ({
	name,
	ts: Date.now(),
	taskId: 'task-1',
	status: 'idle'
});

describe('ObserverHub', () => {
	it('should trigger event-specific hooks', () => {
		const hub = createObserverHub();
		const hook = vi.fn();
		hub.on('start:requested', hook);

		const event = makeEvent('start:requested');
		hub.emit(event);

		expect(hook).toHaveBeenCalledOnce();
		expect(hook).toHaveBeenCalledWith(
			event,
			expect.objectContaining({
				stopImmediatePropagation: expect.any(Function),
				stopPropagation: expect.any(Function)
			})
		);
	});

	it('should trigger onAny hooks for any event', () => {
		const hub = createObserverHub();
		const hook = vi.fn();
		hub.onAny(hook);

		hub.emit(makeEvent('start:requested'));
		hub.emit(makeEvent('artifact:mountSuccess'));

		expect(hook).toHaveBeenCalledTimes(2);
	});

	it('should trigger task-scoped hooks on emitOnTask()', () => {
		const hub = createObserverHub();
		const task1Hook = vi.fn();
		const task2Hook = vi.fn();

		hub.onTask('task-1', 'start:requested', task1Hook);
		hub.onTask('task-2', 'start:requested', task2Hook);

		hub.emitOnTask('task-1', {
			name: 'start:requested',
			ts: Date.now()
		});

		expect(task1Hook).toHaveBeenCalledOnce();
		expect(task1Hook).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'start:requested',
				taskId: 'task-1'
			}),
			expect.objectContaining({
				stopImmediatePropagation: expect.any(Function),
				stopPropagation: expect.any(Function)
			})
		);
		expect(task2Hook).not.toHaveBeenCalled();
	});

	it('should dispatch task, scoped and any hooks when taskId exists', () => {
		const hub = createObserverHub();
		const taskHook = vi.fn();
		const scopedHook = vi.fn();
		const anyHook = vi.fn();

		hub.onTask('task-1', 'start:requested', taskHook);
		hub.on('start:requested', scopedHook);
		hub.onAny(anyHook);

		hub.emit(makeEvent('start:requested'));

		expect(taskHook).toHaveBeenCalledOnce();
		expect(scopedHook).toHaveBeenCalledOnce();
		expect(anyHook).toHaveBeenCalledOnce();
	});

	it('should stop propagation from task hooks to scoped and any hooks', () => {
		const hub = createObserverHub();
		const taskHook = vi.fn((_, ctrl) => {
			ctrl.stopPropagation();
		});
		const nextTaskHook = vi.fn();
		const scopedHook = vi.fn();
		const anyHook = vi.fn();

		hub.onTask('task-1', 'start:requested', taskHook);
		hub.onTask('task-1', 'start:requested', nextTaskHook);
		hub.on('start:requested', scopedHook);
		hub.onAny(anyHook);

		hub.emitOnTask('task-1', {
			name: 'start:requested',
			ts: Date.now()
		});

		expect(taskHook).toHaveBeenCalledOnce();
		expect(nextTaskHook).toHaveBeenCalledOnce();
		expect(scopedHook).not.toHaveBeenCalled();
		expect(anyHook).not.toHaveBeenCalled();
	});

	it('should stop propagation from scoped hooks to any hooks', () => {
		const hub = createObserverHub();
		const scopedHook = vi.fn((_, ctrl) => {
			ctrl.stopPropagation();
		});
		const nextScopedHook = vi.fn();
		const anyHook = vi.fn();

		hub.on('start:requested', scopedHook);
		hub.on('start:requested', nextScopedHook);
		hub.onAny(anyHook);

		hub.emit({
			name: 'start:requested',
			ts: Date.now()
		});

		expect(scopedHook).toHaveBeenCalledOnce();
		expect(nextScopedHook).toHaveBeenCalledOnce();
		expect(anyHook).not.toHaveBeenCalled();
	});

	it('should stop immediate propagation within the current hook scope', () => {
		const hub = createObserverHub();
		const taskHook = vi.fn((_, ctrl) => {
			ctrl.stopImmediatePropagation();
		});
		const nextTaskHook = vi.fn();
		const scopedHook = vi.fn();
		const anyHook = vi.fn();

		hub.onTask('task-1', 'start:requested', taskHook);
		hub.onTask('task-1', 'start:requested', nextTaskHook);
		hub.on('start:requested', scopedHook);
		hub.onAny(anyHook);

		hub.emitOnTask('task-1', {
			name: 'start:requested',
			ts: Date.now()
		});

		expect(taskHook).toHaveBeenCalledOnce();
		expect(nextTaskHook).not.toHaveBeenCalled();
		expect(scopedHook).not.toHaveBeenCalled();
		expect(anyHook).not.toHaveBeenCalled();
	});

	it('should support unsubscribe from on()', () => {
		const hub = createObserverHub();
		const hook = vi.fn();
		const off = hub.on('artifact:mountFail', hook);

		hub.emit(makeEvent('artifact:mountFail'));
		off();
		hub.emit(makeEvent('artifact:mountFail'));

		expect(hook).toHaveBeenCalledTimes(1);
	});

	it('should support unsubscribe from onAny()', () => {
		const hub = createObserverHub();
		const hook = vi.fn();
		const off = hub.onAny(hook);

		hub.emit(makeEvent('task:targetReady'));
		off();
		hub.emit(makeEvent('task:targetReady'));

		expect(hook).toHaveBeenCalledTimes(1);
	});

	it('should support unsubscribe and cleanup with offTask()', () => {
		const hub = createObserverHub();
		const hookA = vi.fn();
		const hookB = vi.fn();

		const offA = hub.onTask('task-1', 'artifact:mountSuccess', hookA);
		hub.onTask('task-1', 'artifact:mountSuccess', hookB);

		offA();
		hub.emitOnTask('task-1', {
			name: 'artifact:mountSuccess',
			ts: Date.now()
		});
		expect(hookA).not.toHaveBeenCalled();
		expect(hookB).toHaveBeenCalledOnce();

		hub.offTask('task-1', 'artifact:mountSuccess');
		hub.emitOnTask('task-1', {
			name: 'artifact:mountSuccess',
			ts: Date.now()
		});
		expect(hookB).toHaveBeenCalledOnce();

		hub.onTask('task-1', 'artifact:mountFail', hookA);
		hub.offTask('task-1');
		hub.emitOnTask('task-1', {
			name: 'artifact:mountFail',
			ts: Date.now()
		});
		expect(hookA).not.toHaveBeenCalled();
	});

	it('should remove specific event hooks with off(event)', () => {
		const hub = createObserverHub();
		const runHook = vi.fn();
		const injectHook = vi.fn();

		hub.on('start:requested', runHook);
		hub.on('artifact:mountSuccess', injectHook);
		hub.off('start:requested');

		hub.emit(makeEvent('start:requested'));
		hub.emit(makeEvent('artifact:mountSuccess'));

		expect(runHook).not.toHaveBeenCalled();
		expect(injectHook).toHaveBeenCalledOnce();
	});

	it('should clear all hooks', () => {
		const hub = createObserverHub();
		const eventHook = vi.fn();
		const anyHook = vi.fn();

		hub.on('alive:enabled', eventHook);
		hub.onAny(anyHook);
		hub.clear();

		hub.emit(makeEvent('alive:enabled'));

		expect(eventHook).not.toHaveBeenCalled();
		expect(anyHook).not.toHaveBeenCalled();
	});

	it('should report hook existence with hasHooks()', () => {
		const hub = createObserverHub();
		expect(hub.hasHooks()).toBe(false);
		expect(hub.hasHooks('artifact:mountSuccess')).toBe(false);

		hub.on('artifact:mountSuccess', () => {});
		expect(hub.hasHooks()).toBe(true);
		expect(hub.hasHooks('artifact:mountSuccess')).toBe(true);
		expect(hub.hasHooks('artifact:mountFail')).toBe(false);
	});

	it('should consider onAny in hasHooks(event)', () => {
		const hub = createObserverHub();
		hub.onAny(() => {});

		expect(hub.hasHooks('register:start')).toBe(true);
		expect(hub.hasHooks()).toBe(true);
	});

	it('should include task-scoped hooks in hasHooks()', () => {
		const hub = createObserverHub();
		hub.onTask('task-1', 'artifact:mountSuccess', () => {});

		expect(hub.hasHooks('artifact:mountSuccess')).toBe(true);
		expect(hub.hasHooks()).toBe(true);
	});

	it('should support task:statusChange hooks', () => {
		const hub = createObserverHub();
		const hook = vi.fn();
		hub.on('task:statusChange', hook);

		hub.emit(makeEvent('task:statusChange'));

		expect(hook).toHaveBeenCalledOnce();
	});

	it('should isolate hook errors and continue dispatch', () => {
		const logger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn()
		};
		const hub = createObserverHub(logger);
		const badHook = vi.fn(() => {
			throw new Error('boom');
		});
		const goodHook = vi.fn();

		hub.on('start:requested', badHook);
		hub.on('start:requested', goodHook);

		hub.emit(makeEvent('start:requested'));

		expect(badHook).toHaveBeenCalledOnce();
		expect(goodHook).toHaveBeenCalledOnce();
		expect(logger.error.mock.calls[0]).toHaveLength(1);
		expect(logger.error.mock.calls[0][0]).toEqual(
			expect.stringContaining(
				'MakooError [MAKOO_HOOK_EXECUTION_FAIL]:\n' +
					'Hook execution failed for event "start:requested"\n' +
					'(event: "start:requested", taskId: "task-1")'
			)
		);
		expect(logger.error.mock.calls[0][0]).toEqual(expect.stringContaining('Error: boom'));
	});

	it('should add event context to an existing MakooError', () => {
		const logger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn()
		};
		const hub = createObserverHub(logger);
		hub.on('start:requested', () => {
			throw new MakooError('Known hook failure');
		});

		hub.emit(makeEvent('start:requested'));

		expect(logger.error.mock.calls[0]).toHaveLength(1);
		expect(logger.error.mock.calls[0][0]).toEqual(
			expect.stringContaining(
				'MakooError [MAKOO_UNKNOWN]:\n' +
					'Known hook failure\n' +
					'(event: "start:requested", taskId: "task-1")'
			)
		);
	});
});
