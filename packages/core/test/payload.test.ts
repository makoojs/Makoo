import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAliveObservePayload } from '../src/payload/buildAliveObservePayload';
import { buildDomObservePayload } from '../src/payload/buildDomObservePayload';
import { createDomObserveEmitFactory } from '../src/payload/createDomObserveEmitFactory';

describe('payload builders', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
	});

	it('builds alive payload metadata for enabled and observer events', () => {
		expect(
			buildAliveObservePayload('alive:enabled', {
				taskId: 'task-1',
				kind: 'component',
				injectAt: '#app',
				status: 'active',
				scope: 'global'
			})
		).toEqual({
			taskId: 'task-1',
			kind: 'component',
			injectAt: '#app',
			status: 'active',
			meta: { scope: 'global' }
		});

		expect(
			buildAliveObservePayload('alive:observerStopped', {
				taskId: 'task-2',
				kind: 'component',
				injectAt: '#panel',
				//component status should be active,because enabling `alive` does not affect the component's state.
				status: 'active',
				scope: 'local',
				observerMode: 'await-target'
			})
		).toEqual({
			taskId: 'task-2',
			kind: 'component',
			injectAt: '#panel',
			status: 'active',
			meta: { scope: 'local', observerMode: 'await-target' }
		});
	});

	it('builds DOM payload metadata for found, timeout, removed, and restored events', () => {
		expect(
			buildDomObservePayload('dom:targetFound', {
				injectAt: '#app',
				taskId: 'task-1',
				kind: 'component',
				durationMs: 12,
				root: 'document'
			})
		).toEqual({
			injectAt: '#app',
			taskId: 'task-1',
			kind: 'component',
			durationMs: 12,
			meta: { root: 'document' }
		});

		expect(
			buildDomObservePayload('dom:targetTimeout', {
				injectAt: '#app',
				taskId: 'task-1',
				kind: 'component',
				durationMs: 99,
				root: 'element'
			})
		).toEqual({
			injectAt: '#app',
			taskId: 'task-1',
			kind: 'component',
			durationMs: 99,
			meta: { root: 'element' }
		});

		expect(
			buildDomObservePayload('dom:targetRemoved', {
				injectAt: '#app',
				taskId: 'task-1',
				kind: 'component'
			})
		).toEqual({
			injectAt: '#app',
			taskId: 'task-1',
			kind: 'component',
			meta: { phase: 'removed' }
		});

		expect(
			buildDomObservePayload('dom:targetRestored', {
				injectAt: '#app',
				taskId: 'task-1',
				kind: 'component',
				durationMs: 45
			})
		).toEqual({
			injectAt: '#app',
			taskId: 'task-1',
			kind: 'component',
			durationMs: 45
		});
	});

	it('emits timeout and restored payloads with durations from the correct reference point', () => {
		const emit = vi.fn();
		const root = document.createElement('div');
		const emitDomEvent = createDomObserveEmitFactory({
			emit,
			taskId: 'task-1',
			kind: 'component',
			injectAt: '#slot',
			root
		});

		vi.advanceTimersByTime(50);
		emitDomEvent('dom:targetTimeout');
		vi.advanceTimersByTime(25);
		emitDomEvent('dom:targetRemoved');
		vi.advanceTimersByTime(10);
		emitDomEvent('dom:targetRestored');

		expect(emit).toHaveBeenNthCalledWith(
			1,
			'dom:targetTimeout',
			expect.objectContaining({
				durationMs: 50,
				meta: { root: 'element' }
			})
		);
		expect(emit).toHaveBeenNthCalledWith(
			2,
			'dom:targetRemoved',
			expect.objectContaining({
				meta: { phase: 'removed' }
			})
		);
		expect(emit).toHaveBeenNthCalledWith(
			3,
			'dom:targetRestored',
			expect.objectContaining({
				durationMs: 10
			})
		);
	});

	it('uses document roots and startup time for found/restored fallback durations', () => {
		const emit = vi.fn();
		const emitDomEvent = createDomObserveEmitFactory({
			emit,
			taskId: 'task-2',
			kind: 'component',
			injectAt: '#main',
			root: document
		});

		vi.advanceTimersByTime(20);
		emitDomEvent('dom:targetFound');
		vi.advanceTimersByTime(15);
		emitDomEvent('dom:targetRestored');

		expect(emit).toHaveBeenNthCalledWith(
			1,
			'dom:targetFound',
			expect.objectContaining({
				durationMs: 20,
				meta: { root: 'document' }
			})
		);
		expect(emit).toHaveBeenNthCalledWith(
			2,
			'dom:targetRestored',
			expect.objectContaining({
				durationMs: 35
			})
		);
	});
});
