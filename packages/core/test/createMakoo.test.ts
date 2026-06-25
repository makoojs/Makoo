import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakoo, ErrorCode, inject, listen, TaskError } from '../src';
import type { AdapterMountInput, ResolvableMountAdapter } from '../src/adapter/types';
import { createObserverHub } from '../src/hooks/ObserverHub';
import { Logger } from '../src/logger/Logger';
import { DOMWatcher } from '../src/watcher/DomWatcher';

type PlainArtifact = {
	name: string;
};

function createPlainAdapter(
	mount: ResolvableMountAdapter<PlainArtifact, { mounted: boolean }>['mount'] = vi.fn(() => ({
		handle: { mounted: true }
	})),
	unmount: ResolvableMountAdapter<PlainArtifact, { mounted: boolean }>['unmount'] = vi.fn()
): ResolvableMountAdapter<PlainArtifact, { mounted: boolean }> {
	return {
		name: 'plain',
		matches(candidate): candidate is PlainArtifact {
			return (
				typeof candidate === 'object' &&
				candidate !== null &&
				(candidate as PlainArtifact).name?.startsWith('Plain') === true
			);
		},
		mount,
		unmount
	};
}

describe('createMakoo', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('should start component declarations with configured adapters and expose task handles', () => {
		const host = document.createElement('div');
		host.id = 'plain-host';
		document.body.appendChild(host);
		const artifact = { name: 'PlainCard' };
		let mountInput: AdapterMountInput<PlainArtifact> | undefined;
		const mount = vi.fn((input: AdapterMountInput<PlainArtifact>) => {
			mountInput = input;
			return { handle: { mounted: true }, instance: input.artifact };
		});
		const unmount = vi.fn();

		const makoo = createMakoo({
			adapters: [createPlainAdapter(mount, unmount)]
		});

		const started = makoo.start([inject('#plain-host', artifact)]);
		const task = started.get('PlainCard@#plain-host');

		expect(started.tasks).toHaveLength(1);
		expect(task).toMatchObject({
			kind: 'component',
			taskId: 'PlainCard@#plain-host'
		});
		expect(mount).toHaveBeenCalledOnce();
		expect(mountInput).toMatchObject({
			host,
			artifact,
			taskId: 'PlainCard@#plain-host',
			injectAt: '#plain-host',
			makoo: expect.objectContaining({
				taskId: 'PlainCard@#plain-host',
				injectAt: '#plain-host',
				enableAlive: expect.any(Function),
				disableAlive: expect.any(Function),
				reset: expect.any(Function),
				destroy: expect.any(Function),
				on: expect.any(Function),
				onTask: expect.any(Function),
				off: expect.any(Function),
				offTask: expect.any(Function),
				getLogger: expect.any(Function),
				bindListenerSignal: expect.any(Function),
				controlListener: expect.any(Function)
			})
		});

		task?.destroy();

		expect(unmount).toHaveBeenCalledOnce();
		expect(started.get('PlainCard@#plain-host')).toBeUndefined();
	});

	it('should start listener declarations and expose listener controls', () => {
		const button = document.createElement('button');
		button.id = 'listener-button';
		document.body.appendChild(button);
		const callback = vi.fn();
		const makoo = createMakoo();

		const started = makoo.start([listen('#listener-button', 'click', callback)]);
		const task = started.get('listener-#listener-button-click');

		button.click();
		expect(callback).toHaveBeenCalledTimes(1);
		expect(task).toMatchObject({
			kind: 'listener',
			taskId: 'listener-#listener-button-click',
			open: expect.any(Function),
			close: expect.any(Function),
			destroy: expect.any(Function)
		});

		expect(task?.kind === 'listener' ? task.close() : false).toBe(true);
		button.click();
		expect(callback).toHaveBeenCalledTimes(1);

		expect(task?.kind === 'listener' ? task.open() : false).toBe(true);
		button.click();
		expect(callback).toHaveBeenCalledTimes(2);
	});

	it('should throw a task error when starting an empty batch', () => {
		const makoo = createMakoo();

		expect(() => makoo.start([])).toThrow(TaskError);

		try {
			makoo.start([]);
		} catch (error) {
			expect(error).toBeInstanceOf(TaskError);
			expect((error as TaskError).code).toBe(ErrorCode.TASK_NO_REGISTERED);
		}
	});

	it('should keep StartedTasks.destroyAll scoped to the current start batch', () => {
		const firstHost = document.createElement('div');
		firstHost.id = 'first-host';
		document.body.appendChild(firstHost);
		const secondHost = document.createElement('div');
		secondHost.id = 'second-host';
		document.body.appendChild(secondHost);
		const unmount = vi.fn();
		const makoo = createMakoo({
			adapters: [createPlainAdapter(undefined, unmount)]
		});

		const first = makoo.start([inject('#first-host', { name: 'PlainFirst' })]);
		const second = makoo.start([inject('#second-host', { name: 'PlainSecond' })]);

		first.destroyAll();

		expect(first.get('PlainFirst@#first-host')).toBeUndefined();
		expect(second.get('PlainSecond@#second-host')).toBeDefined();
		expect(unmount).toHaveBeenCalledTimes(1);

		makoo.destroyAll();

		expect(second.get('PlainSecond@#second-host')).toBeUndefined();
		expect(unmount).toHaveBeenCalledTimes(2);
	});

	it('should not include duplicate declarations in the current start batch', () => {
		const host = document.createElement('div');
		host.id = 'duplicate-host';
		document.body.appendChild(host);
		const unmount = vi.fn();
		const makoo = createMakoo({
			adapters: [createPlainAdapter(undefined, unmount)]
		});
		const declaration = inject('#duplicate-host', { name: 'PlainDuplicate' });

		const first = makoo.start([declaration]);
		const second = makoo.start([declaration]);

		expect(second.tasks).toHaveLength(0);

		second.destroyAll();

		expect(first.get('PlainDuplicate@#duplicate-host')).toBeDefined();
		expect(unmount).not.toHaveBeenCalled();
	});

	it('should apply defaults and global hooks when starting tasks', () => {
		const startHook = vi.fn();
		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});
		const makoo = createMakoo({
			defaults: {
				timeout: 1234
			},
			adapters: [createPlainAdapter()],
			hooks: {
				'start:requested': startHook
			}
		});

		makoo.start([inject('#missing-host', { name: 'PlainMissing' })]);

		expect(startHook).toHaveBeenCalledOnce();
		expect(readySpy).toHaveBeenCalledWith(
			'#missing-host',
			expect.any(Function),
			document,
			{
				once: true,
				timeout: 1234
			},
			expect.objectContaining({
				logger: expect.anything(),
				emit: expect.any(Function)
			})
		);
	});

	it('should expose observer facade methods and custom logger', () => {
		const observer = createObserverHub();
		const logger = new Logger();
		const makoo = createMakoo({
			observer,
			logger
		});
		const hook = vi.fn();
		const anyHook = vi.fn();
		const offSpy = vi.spyOn(observer, 'off');
		const offTaskSpy = vi.spyOn(observer, 'offTask');
		const offAnySpy = vi.spyOn(observer, 'offAny');

		const off = makoo.on('start:requested', hook);
		const offTask = makoo.onTask('task-a', 'start:requested', hook);
		const offAny = makoo.onAny(anyHook);
		makoo.off('start:requested', hook);
		makoo.offTask('task-a', 'start:requested', hook);
		makoo.offAny(anyHook);
		off();
		offTask();
		offAny();

		expect(makoo.getLogger()).toBe(logger);
		expect(offSpy).toHaveBeenCalledWith('start:requested', hook);
		expect(offTaskSpy).toHaveBeenCalledWith('task-a', 'start:requested', hook);
		expect(offAnySpy).toHaveBeenCalledWith(anyHook);
	});
});
