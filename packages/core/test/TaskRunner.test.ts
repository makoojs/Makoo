import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVueAdapter } from '../../vue/src/VueAdapter';
import { VuePlugin } from '../../vue/src/VuePlugin';
import { Action } from '../src';
import { createAdapterRegistry } from '../src/adapter/Adapter';
import type { MakooContext } from '../src/adapter/types';
import { AdapterError } from '../src/error/AdapterError';
import { ErrorCode } from '../src/error/ErrorCode';
import { TaskError } from '../src/error/TaskError';
import { createObserverHub } from '../src/hooks/ObserverHub';
import type { ObserveEvent } from '../src/hooks/types';
import { createObserveEmitter } from '../src/hooks/util';
import { Logger } from '../src/logger/Logger';
import type { MakooRuntimeState } from '../src/runtime/types';
import { createActivityStore } from '../src/signal/observeActivitySignal';
import type { SignalUnsubscribe } from '../src/signal/types';
import { createTaskContext, type TaskContext } from '../src/Task/TaskContext';
import {
	bindListenerSignal,
	controlListener,
	onTargetReady,
	startTasks
} from '../src/Task/TaskRunner';
import type { ArtifactTask, ListenerTask } from '../src/Task/types';
import { DOMWatcher } from '../src/watcher/DomWatcher';
import { createArtifactTask, createListenerTask, createVueComponent } from './factory/TaskFactor';

function createMakooContext(taskId: string, injectAt: string): MakooContext {
	return {
		taskId,
		injectAt,
		enableAlive: vi.fn(),
		disableAlive: vi.fn(),
		reset: vi.fn(),
		destroy: vi.fn(),
		on: vi.fn(() => vi.fn()),
		onTask: vi.fn(() => vi.fn()),
		off: vi.fn(),
		offTask: vi.fn(),
		getLogger: vi.fn(() => new Logger()),
		bindListenerSignal: vi.fn(() => false),
		controlListener: vi.fn(() => false)
	};
}

describe('TaskRunner', () => {
	let taskContext: TaskContext;
	let runtime: MakooRuntimeState;
	let vueAdapter: ReturnType<typeof createVueAdapter>;

	function createRuntime(observer = createObserverHub()): MakooRuntimeState {
		const logger = new Logger();

		return {
			config: {
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger,
				observer
			},
			logger,
			emit: createObserveEmitter(observer),
			taskContext,
			adapterRegistry: createAdapterRegistry(),
			makooContext: createMakooContext
		};
	}

	beforeEach(() => {
		const observer = createObserverHub();
		taskContext = createTaskContext();
		vueAdapter = createVueAdapter();
		runtime = createRuntime(observer);
		document.body.innerHTML = '';
		vi.spyOn(console, 'info').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		VuePlugin.clear();
		document.body.innerHTML = '';
	});

	function getRegisteredTaskIds(): string[] {
		return taskContext.taskRecords.map(({ taskId }) => taskId);
	}

	it('should throw when no task exists on run', () => {
		expect(() => startTasks(runtime, [])).toThrow(TaskError);
		try {
			startTasks(runtime, []);
		} catch (err) {
			expect(err).toBeInstanceOf(TaskError);
			const e = err as TaskError;
			expect(e.code).toBe(ErrorCode.TASK_NO_REGISTERED);
			expect(e.message).toContain('[makoo]');
			expect(e.message).toContain('No registered tasks found');
		}
	});

	it('should emit normalized run payloads for start, skipped and scheduled', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);

		taskContext.set(
			'run-idle-task',
			createArtifactTask({
				taskId: 'run-idle-task',
				taskStatus: 'idle',
				injectAt: '#run-idle',
				timeout: 7000
			})
		);
		taskContext.set(
			'run-pending-task',
			createListenerTask({
				taskId: 'run-pending-task',
				taskStatus: 'pending',
				listenAt: '#run-pending',
				event: 'click',
				callback: vi.fn(),
				withEvent: true
			})
		);
		taskContext.set(
			'run-active-task',
			createArtifactTask({
				taskId: 'run-active-task',
				taskStatus: 'active',
				injectAt: '#run-active'
			})
		);

		taskContext.taskRecords.push({ taskId: 'run-idle-task', injectAt: '#run-idle' });
		taskContext.taskRecords.push({ taskId: 'run-pending-task', injectAt: '#run-pending' });
		taskContext.taskRecords.push({ taskId: 'run-active-task', injectAt: '#run-active' });

		vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		const runEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('start:')) {
				runEvents.push(event);
			}
		});

		startTasks(runtime, getRegisteredTaskIds());

		expect(runEvents.find((event) => event.name === 'start:requested')).toMatchObject({
			name: 'start:requested',
			meta: {
				totalTasks: 3,
				idleTasks: 1,
				pendingTasks: 1,
				activeTasks: 1
			}
		});

		expect(
			runEvents.find(
				(event) => event.name === 'start:taskSkipped' && event.taskId === 'run-pending-task'
			)
		).toMatchObject({
			name: 'start:taskSkipped',
			taskId: 'run-pending-task',
			kind: 'listener',
			injectAt: '#run-pending',
			status: 'pending',
			meta: {
				skipReason: 'already-pending'
			}
		});

		expect(
			runEvents.find(
				(event) => event.name === 'start:taskSkipped' && event.taskId === 'run-active-task'
			)
		).toMatchObject({
			name: 'start:taskSkipped',
			taskId: 'run-active-task',
			kind: 'component',
			injectAt: '#run-active',
			status: 'active',
			meta: {
				skipReason: 'already-active'
			}
		});

		expect(
			runEvents.find(
				(event) => event.name === 'start:taskScheduled' && event.taskId === 'run-idle-task'
			)
		).toMatchObject({
			name: 'start:taskScheduled',
			taskId: 'run-idle-task',
			kind: 'component',
			injectAt: '#run-idle',
			status: 'pending',
			preStatus: 'idle',
			meta: {
				timeout: 7000
			}
		});
	});

	it('should schedule onDomReady and mark task pending on run', () => {
		taskContext.set(
			'task-a',
			createArtifactTask({
				taskId: 'task-a',
				taskStatus: 'idle'
			})
		);
		taskContext.taskRecords.push({ taskId: 'task-a', injectAt: '#app' });

		const spy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		startTasks(runtime, getRegisteredTaskIds());

		expect(spy).toHaveBeenCalledWith(
			'#app',
			expect.any(Function),
			document,
			expect.objectContaining({
				once: true
			}),
			expect.objectContaining({
				logger: expect.anything(),
				emit: expect.any(Function)
			})
		);
		expect(taskContext.getTaskStatus('task-a')).toBe('pending');
	});

	it('should skip task that is active or pending on run', () => {
		taskContext.set(
			'active-task',
			createArtifactTask({
				taskId: 'active-task',
				taskStatus: 'active'
			})
		);
		taskContext.set(
			'pending-task',
			createArtifactTask({
				taskId: 'pending-task',
				taskStatus: 'pending'
			})
		);
		taskContext.taskRecords.push({ taskId: 'active-task', injectAt: '#a' });
		taskContext.taskRecords.push({ taskId: 'pending-task', injectAt: '#b' });

		const spy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		startTasks(runtime, getRegisteredTaskIds());

		expect(spy).not.toHaveBeenCalled();
	});

	it('should mount component and mark task active on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'host';
		document.body.appendChild(host);

		const task = createArtifactTask({
			taskId: 'mount-task',
			taskStatus: 'idle',
			artifactName: 'MountComp',
			injectAt: '#host',
			artifact: createVueComponent('MountComp')
		});

		taskContext.set(task.taskId, task);
		onTargetReady(runtime, host, task.taskId);

		expect(task.mountHandle).toBeDefined();
		expect(task.appRoot?.parentElement).toBe(host);
		expect(task.taskStatus).toBe('active');
	});

	it('should emit normalized target ready payload', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);

		taskContext.set(
			'target-ready-listener',
			createListenerTask({
				taskId: 'target-ready-listener',
				taskStatus: 'idle',
				listenAt: '#target-ready',
				event: 'click',
				callback: vi.fn(),
				withEvent: false
			})
		);

		const targetEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name === 'task:targetReady') {
				targetEvents.push(event);
			}
		});

		onTargetReady(runtime, document.createElement('div'), 'target-ready-listener');

		expect(targetEvents[0]).toMatchObject({
			name: 'task:targetReady',
			taskId: 'target-ready-listener',
			kind: 'listener',
			injectAt: '#target-ready',
			status: 'idle'
		});
	});

	it('should emit normalized inject start and success payloads', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);

		const host = document.createElement('div');
		host.id = 'inject-observe-host';
		document.body.appendChild(host);

		const btn = document.createElement('button');
		btn.id = 'inject-observe-btn';
		document.body.appendChild(btn);

		taskContext.set(
			'inject-observe-task',
			createArtifactTask({
				taskId: 'inject-observe-task',
				taskStatus: 'idle',
				artifactName: 'InjectObserveComp',
				injectAt: '#inject-observe-host',
				artifact: createVueComponent('InjectObserveComp'),
				alive: true,
				scope: 'global',
				withEvent: true,
				listener: {
					listenAt: '#inject-observe-btn',
					event: 'click',
					callback: vi.fn()
				}
			})
		);

		const injectEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('artifact:mount')) {
				injectEvents.push(event);
			}
		});

		onTargetReady(runtime, host, 'inject-observe-task');

		expect(injectEvents[0]).toMatchObject({
			name: 'artifact:mountStart',
			taskId: 'inject-observe-task',
			kind: 'component',
			injectAt: '#inject-observe-host',
			status: 'idle',
			meta: {
				artifactName: 'InjectObserveComp',
				alive: true,
				scope: 'global',
				withEvent: true
			}
		});

		expect(injectEvents[1]).toMatchObject({
			name: 'artifact:mountSuccess',
			taskId: 'inject-observe-task',
			kind: 'component',
			injectAt: '#inject-observe-host',
			status: 'idle',
			meta: {
				artifactName: 'InjectObserveComp',
				alive: true,
				scope: 'global'
			}
		});
	});

	it('should emit alive observer started when alive component starts after mount', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);

		const host = document.createElement('div');
		host.id = 'alive-observe-host';
		document.body.appendChild(host);
		vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});

		taskContext.set(
			'alive-observe-task',
			createArtifactTask({
				taskId: 'alive-observe-task',
				taskStatus: 'idle',
				artifactName: 'AliveObserveComp',
				injectAt: '#alive-observe-host',
				artifact: createVueComponent('AliveObserveComp'),
				alive: true,
				scope: 'global',
				isObserver: false
			})
		);

		const aliveEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('alive:')) {
				aliveEvents.push(event);
			}
		});

		onTargetReady(runtime, host, 'alive-observe-task');

		expect(aliveEvents.find((event) => event.name === 'alive:observerStarted')).toMatchObject({
			name: 'alive:observerStarted',
			taskId: 'alive-observe-task',
			kind: 'component',
			injectAt: '#alive-observe-host',
			status: 'idle',
			meta: {
				scope: 'global',
				observerMode: 'mounted'
			}
		});
	});

	it('should emit normalized inject fail payload', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);

		taskContext.set(
			'inject-fail-task',
			createArtifactTask({
				taskId: 'inject-fail-task',
				taskStatus: 'pending',
				artifactName: 'InjectFailComp',
				injectAt: '#inject-fail-host',
				artifact: createVueComponent('InjectFailComp'),
				alive: false,
				scope: 'local'
			})
		);

		const injectEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('artifact:mount')) {
				injectEvents.push(event);
			}
		});

		onTargetReady(runtime, document.createElement('div'), 'inject-fail-task');

		expect(injectEvents[0]).toMatchObject({
			name: 'artifact:mountStart',
			taskId: 'inject-fail-task',
			kind: 'component',
			injectAt: '#inject-fail-host',
			status: 'pending',
			meta: {
				artifactName: 'InjectFailComp',
				alive: false,
				scope: 'local',
				withEvent: false
			}
		});

		expect(injectEvents[1]).toMatchObject({
			name: 'artifact:mountFail',
			taskId: 'inject-fail-task',
			kind: 'component',
			injectAt: '#inject-fail-host',
			status: 'idle',
			meta: {
				artifactName: 'InjectFailComp'
			}
		});
		expect(injectEvents[1].error).toBeDefined();
		expect(injectEvents[1].error).toBeInstanceOf(TaskError);
		expect((injectEvents[1].error as TaskError).code).toBe(ErrorCode.TASK_TARGET_DETACHED);
	});

	it('should emit task:statusChange with status active when a task becomes active', () => {
		const observer = createObserverHub();
		const statusEvents: ObserveEvent[] = [];
		taskContext = createTaskContext(createObserveEmitter(observer), new Logger());
		runtime = createRuntime(observer);
		observer.on('task:statusChange', (event) => {
			statusEvents.push(event);
		});

		const host = document.createElement('div');
		host.id = 'active-event-host';
		document.body.appendChild(host);

		taskContext.set(
			'active-event-task',
			createArtifactTask({
				taskId: 'active-event-task',
				taskStatus: 'idle',
				artifactName: 'ActiveEventComp',
				injectAt: '#active-event-host',
				artifact: createVueComponent('ActiveEventComp')
			})
		);

		onTargetReady(runtime, host, 'active-event-task');

		expect(statusEvents.find((e) => e.status === 'active')).toMatchObject({
			name: 'task:statusChange',
			taskId: 'active-event-task',
			kind: 'component',
			injectAt: '#active-event-host',
			status: 'active',
			preStatus: 'idle'
		});
	});

	it('should install all registered shared plugins when mounting component', () => {
		const host = document.createElement('div');
		host.id = 'plugin-host';
		document.body.appendChild(host);
		const pluginA = { install: vi.fn() };
		const pluginB = { install: vi.fn() };

		VuePlugin.usePlugins(pluginA, pluginB);
		taskContext.set(
			'plugin-task',
			createArtifactTask({
				taskId: 'plugin-task',
				taskStatus: 'idle',
				artifactName: 'PluginComp',
				injectAt: '#plugin-host',
				artifact: createVueComponent('PluginComp'),
				adapter: vueAdapter
			})
		);

		onTargetReady(runtime, host, 'plugin-task');

		expect(pluginA.install).toHaveBeenCalledOnce();
		expect(pluginB.install).toHaveBeenCalledOnce();
	});

	it('should route to bindListenerSignal when activitySignal exists on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'route-signal';
		document.body.appendChild(host);

		vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});
		const signal = createActivityStore(true);

		taskContext.set(
			'route-task',
			createListenerTask({
				taskId: 'route-task',
				taskStatus: 'idle',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				activitySignal: () => signal
			})
		);

		onTargetReady(runtime, host, 'route-task');

		expect(taskContext.get<ListenerTask>('route-task')?.watcher).toBeDefined();
	});

	it('should route to controlListener OPEN without activitySignal on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'route-open';
		document.body.appendChild(host);

		const button = document.createElement('button');
		button.id = 'btn';
		document.body.appendChild(button);

		taskContext.set(
			'open-task',
			createArtifactTask({
				taskId: 'open-task',
				taskStatus: 'idle',
				artifactName: 'OpenComp',
				injectAt: '#route-open',
				artifact: createVueComponent('OpenComp'),
				withEvent: true,
				listener: {
					listenAt: '#btn',
					event: 'click',
					callback: vi.fn()
				}
			})
		);

		onTargetReady(runtime, host, 'open-task');

		expect(taskContext.get<ArtifactTask>('open-task')?.listener?.controller).toBeInstanceOf(
			AbortController
		);
	});

	it('should stop previous watcher and respond immediately on bindListenerSignal', () => {
		const oldWatcher = vi.fn() as unknown as SignalUnsubscribe;
		const source = createActivityStore(false);
		const button = document.createElement('button');
		button.id = 'btn';
		document.body.appendChild(button);

		taskContext.set(
			'signal-task',
			createListenerTask({
				taskId: 'signal-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				watcher: {
					watcher: oldWatcher,
					watchSource: source
				}
			})
		);

		bindListenerSignal(runtime, 'signal-task', source);
		expect(oldWatcher).toHaveBeenCalledOnce();
		expect(taskContext.get<ListenerTask>('signal-task')?.controller).toBeUndefined();

		source.set(true);
		expect(taskContext.get<ListenerTask>('signal-task')?.controller).toBeInstanceOf(
			AbortController
		);
	});

	it('should attach and detach event on controlListener open and close', () => {
		const btn = document.createElement('button');
		btn.id = 'listener-btn';
		document.body.appendChild(btn);

		const callback = vi.fn();
		taskContext.set(
			'listener-task',
			createListenerTask({
				taskId: 'listener-task',
				withEvent: true,
				listenAt: '#listener-btn',
				event: 'click',
				callback
			})
		);

		expect(controlListener(runtime, 'listener-task', Action.OPEN)).toBe(true);
		btn.click();
		expect(callback).toHaveBeenCalledOnce();

		expect(controlListener(runtime, 'listener-task', Action.CLOSE)).toBe(true);
		btn.click();
		expect(callback).toHaveBeenCalledOnce();
	});

	it('should use capture when the listener target already exists', () => {
		const btn = document.createElement('button');
		btn.id = 'capture-listener-btn';
		document.body.appendChild(btn);
		const callback = vi.fn();
		const addEventSpy = vi.spyOn(btn, 'addEventListener');
		taskContext.set(
			'capture-listener-task',
			createListenerTask({
				taskId: 'capture-listener-task',
				withEvent: true,
				listenAt: '#capture-listener-btn',
				event: 'click',
				callback,
				capture: true
			})
		);

		expect(controlListener(runtime, 'capture-listener-task', Action.OPEN)).toBe(true);
		expect(addEventSpy).toHaveBeenCalledWith('click', callback, {
			capture: true,
			signal: expect.any(AbortSignal)
		});
	});

	it('should default to the bubbling phase when capture is omitted', () => {
		const btn = document.createElement('button');
		btn.id = 'bubble-listener-btn';
		document.body.appendChild(btn);
		const callback = vi.fn();
		const addEventSpy = vi.spyOn(btn, 'addEventListener');
		taskContext.set(
			'bubble-listener-task',
			createListenerTask({
				taskId: 'bubble-listener-task',
				withEvent: true,
				listenAt: '#bubble-listener-btn',
				event: 'click',
				callback
			})
		);

		expect(controlListener(runtime, 'bubble-listener-task', Action.OPEN)).toBe(true);
		expect(addEventSpy).toHaveBeenCalledWith('click', callback, {
			capture: false,
			signal: expect.any(AbortSignal)
		});
	});

	it('should emit normalized listener open and close payloads', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);

		const btn = document.createElement('button');
		btn.id = 'listener-observe-btn';
		document.body.appendChild(btn);

		taskContext.set(
			'listener-observe-task',
			createListenerTask({
				taskId: 'listener-observe-task',
				taskStatus: 'idle',
				withEvent: true,
				listenAt: '#listener-observe-btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		const listenerEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('listener:')) {
				listenerEvents.push(event);
			}
		});

		expect(controlListener(runtime, 'listener-observe-task', Action.OPEN)).toBe(true);
		expect(controlListener(runtime, 'listener-observe-task', Action.CLOSE)).toBe(true);

		expect(
			listenerEvents.find(
				(event) =>
					event.name === 'listener:attached' && event.taskId === 'listener-observe-task'
			)
		).toMatchObject({
			name: 'listener:attached',
			taskId: 'listener-observe-task',
			kind: 'listener',
			injectAt: '#listener-observe-btn',
			status: 'idle',
			meta: {
				listenerEvent: 'click',
				listenAt: '#listener-observe-btn'
			}
		});

		expect(
			listenerEvents.find(
				(event) =>
					event.name === 'listener:detached' && event.taskId === 'listener-observe-task'
			)
		).toMatchObject({
			name: 'listener:detached',
			taskId: 'listener-observe-task',
			kind: 'listener',
			injectAt: '#listener-observe-btn',
			status: 'idle',
			meta: {
				listenerEvent: 'click',
				listenAt: '#listener-observe-btn'
			}
		});
	});

	it('should emit normalized listener attachFail payload', () => {
		const observer = createObserverHub();
		runtime = createRuntime(observer);
		const brokenSignal = {
			get: () => true,
			subscribe: () => {
				throw new Error('signal failed');
			}
		};

		taskContext.set(
			'listener-fail-task',
			createListenerTask({
				taskId: 'listener-fail-task',
				taskStatus: 'pending',
				withEvent: true,
				listenAt: '#listener-fail-btn',
				event: 'mouseenter',
				callback: vi.fn(),
				activitySignal: () => brokenSignal
			})
		);

		const listenerEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('listener:')) {
				listenerEvents.push(event);
			}
		});

		onTargetReady(runtime, document.createElement('div'), 'listener-fail-task');

		const failEvent = listenerEvents.find(
			(event) => event.name === 'listener:attachFail' && event.taskId === 'listener-fail-task'
		);
		expect(failEvent).toMatchObject({
			name: 'listener:attachFail',
			taskId: 'listener-fail-task',
			kind: 'listener',
			injectAt: '#listener-fail-btn',
			status: 'idle',
			meta: {
				listenerEvent: 'mouseenter',
				listenAt: '#listener-fail-btn'
			}
		});
		expect(failEvent?.error).toBeInstanceOf(Error);
		expect(failEvent?.error).toBeInstanceOf(TaskError);
		expect((failEvent?.error as TaskError).code).toBe(ErrorCode.TASK_LISTENER_ATTACH_FAIL);
	});

	it('should stop previous watcher without emitting watcher release when rebinding listener activity signal', () => {
		const observer = createObserverHub();
		taskContext = createTaskContext(createObserveEmitter(observer), new Logger());
		runtime = createRuntime(observer);
		const previousWatcher = vi.fn();
		const source = createActivityStore(true);

		taskContext.set(
			'rebind-signal-task',
			createListenerTask({
				taskId: 'rebind-signal-task',
				taskStatus: 'active',
				withEvent: true,
				listenAt: '#rebind-signal-btn',
				event: 'click',
				callback: vi.fn(),
				watcher: {
					watcher: previousWatcher,
					watchSource: createActivityStore(false)
				}
			})
		);

		const resourceEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name === 'signal:watcherReleased') {
				resourceEvents.push(event);
			}
		});

		expect(bindListenerSignal(runtime, 'rebind-signal-task', source)).toBe(true);

		expect(previousWatcher).toHaveBeenCalledOnce();
		expect(resourceEvents).toHaveLength(0);
	});

	it('should warn and return false when listener config is missing', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set(
			'invalid-event',
			createListenerTask({
				taskId: 'invalid-event',
				withEvent: true,
				listenAt: '',
				event: 'invalid-event',
				callback: undefined
			})
		);

		const result = controlListener(runtime, 'invalid-event', Action.OPEN);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Task "invalid-event" has no event binding configured')
		);
	});

	it('should warn on invalid action in controlListener', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set(
			'invalid-action',
			createListenerTask({
				taskId: 'invalid-action',
				withEvent: true,
				listenAt: '#x',
				event: 'click',
				callback: vi.fn()
			})
		);

		const result = controlListener(runtime, 'invalid-action', 'UNKNOWN' as Action);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action type'));
	});

	it('should start onDomAlive for alive component after successful mount', () => {
		const host = document.createElement('div');
		host.id = 'alive-host';
		document.body.appendChild(host);

		const stopHandler = vi.fn();
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);
		taskContext.set(
			'alive-task',
			createArtifactTask({
				taskId: 'alive-task',
				taskStatus: 'idle',
				artifactName: 'AliveComp',
				injectAt: '#alive-host',
				artifact: createVueComponent('AliveComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		onTargetReady(runtime, host, 'alive-task');

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(stopHandler).not.toHaveBeenCalled();
		expect(taskContext.get<ArtifactTask>('alive-task')?.disableAlive).toBe(stopHandler);
		expect(taskContext.get<ArtifactTask>('alive-task')?.isObserver).toBe(true);
	});

	it('should keep task idle when target is detached on onTargetReady', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const detached = document.createElement('div');

		taskContext.set(
			'detached-task',
			createArtifactTask({
				taskId: 'detached-task',
				taskStatus: 'pending',
				artifactName: 'DetachedComp',
				injectAt: '#detached',
				artifact: createVueComponent('DetachedComp')
			})
		);

		onTargetReady(runtime, detached, 'detached-task');

		expect(taskContext.get('detached-task')?.taskStatus).toBe('idle');
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('detached from DOM'));
	});

	it('should warn and return when task is missing on onTargetReady', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		onTargetReady(runtime, document.createElement('div'), 'missing-task');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Task "missing-task" not found')
		);
	});

	it('should return early when task is already active on onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		taskContext.set(
			'active-short-circuit',
			createArtifactTask({
				taskId: 'active-short-circuit',
				taskStatus: 'active',
				artifactName: 'AlreadyActiveComp',
				injectAt: '#x',
				artifact: createVueComponent('AlreadyActiveComp')
			})
		);

		onTargetReady(runtime, host, 'active-short-circuit');

		expect(taskContext.get('active-short-circuit')?.taskStatus).toBe('active');
	});

	it('should set task idle when event binding fails on onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const brokenSignal = {
			get: () => true,
			subscribe: () => {
				throw new Error('signal failed');
			}
		};

		taskContext.set(
			'event-fail-task',
			createListenerTask({
				taskId: 'event-fail-task',
				taskStatus: 'pending',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				activitySignal: () => brokenSignal
			})
		);

		onTargetReady(runtime, host, 'event-fail-task');
		expect(taskContext.get('event-fail-task')?.taskStatus).toBe('idle');
	});

	it('should return false when bindListenerSignal task is missing', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = bindListenerSignal(
			runtime,
			'missing-signal-task',
			createActivityStore(true)
		);
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('unable to bind activity signal')
		);
	});

	it('should return false when watch throws in bindListenerSignal', () => {
		taskContext.set(
			'watch-error-task',
			createListenerTask({
				taskId: 'watch-error-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		vi.spyOn(document, 'querySelector').mockImplementation(() => {
			throw new Error('watch failed');
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = bindListenerSignal(runtime, 'watch-error-task', createActivityStore(true));

		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to bind activity signal'),
			expect.any(Error)
		);
	});

	it('should return false when task is missing in controlListener', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = controlListener(runtime, 'missing-listener-task', Action.OPEN);
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('unable to manage listener state')
		);
	});

	it('should return false when event binding config is incomplete in controlListener', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set(
			'incomplete-listener-task',
			createListenerTask({
				taskId: 'incomplete-listener-task',
				withEvent: true,
				listenAt: '',
				event: '',
				callback: undefined
			})
		);

		const result = controlListener(runtime, 'incomplete-listener-task', Action.OPEN);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('has no event binding configured')
		);
	});

	it('should skip OPEN when controller already exists in controlListener', () => {
		const addEventSpy = vi.spyOn(Element.prototype, 'addEventListener');
		taskContext.set(
			'opened-task',
			createListenerTask({
				taskId: 'opened-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				controller: new AbortController()
			})
		);

		const result = controlListener(runtime, 'opened-task', Action.OPEN);
		expect(result).toBe(false);
		expect(addEventSpy).not.toHaveBeenCalled();
	});

	it('should keep returning false when CLOSE is called without controller', () => {
		taskContext.set(
			'closed-task',
			createListenerTask({
				taskId: 'closed-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		const result = controlListener(runtime, 'closed-task', Action.CLOSE);
		expect(result).toBe(false);
	});

	it('should use onDomReady fallback when listen target does not exist in OPEN', () => {
		const delayedTarget = document.createElement('button');
		const addEventSpy = vi.spyOn(delayedTarget, 'addEventListener');
		const callback = vi.fn();
		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_, cb) => {
			const el = delayedTarget;
			cb(el);
			return () => {};
		});
		taskContext.set(
			'fallback-open-task',
			createListenerTask({
				taskId: 'fallback-open-task',
				withEvent: true,
				listenAt: '#non-existing-btn',
				event: 'click',
				callback,
				capture: true
			})
		);

		const result = controlListener(runtime, 'fallback-open-task', Action.OPEN);
		expect(result).toBe(true);
		expect(readySpy).toHaveBeenCalledOnce();
		expect(addEventSpy).toHaveBeenCalledWith('click', callback, {
			capture: true,
			signal: expect.any(AbortSignal)
		});
		expect(taskContext.get<ListenerTask>('fallback-open-task')?.controller).toBeInstanceOf(
			AbortController
		);
	});

	it('should set task idle when component taskId field is empty in onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		taskContext.set(
			'broken-task-key',
			createArtifactTask({
				taskId: '',
				taskStatus: 'pending',
				artifactName: 'BrokenComp',
				injectAt: '#host',
				artifact: createVueComponent('BrokenComp')
			})
		);

		onTargetReady(runtime, host, 'broken-task-key');
		expect(taskContext.get('broken-task-key')?.taskStatus).toBe('idle');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('No artifact found for task')
		);
	});

	it('should set task idle when component mount throws in onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		taskContext.set(
			'mount-error-task',
			createArtifactTask({
				taskId: 'mount-error-task',
				taskStatus: 'pending',
				artifactName: 'MountErrorComp',
				injectAt: '#host',
				artifact: {
					name: 'MountErrorComp',
					render: () => {
						throw new Error('mount failed');
					}
				}
			})
		);

		onTargetReady(runtime, host, 'mount-error-task');
		expect(taskContext.get('mount-error-task')?.taskStatus).toBe('idle');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Artifact mount failed for task'),
			expect.any(AdapterError)
		);
		expect((errorSpy.mock.calls[0][1] as AdapterError).code).toBe(ErrorCode.ADAPTER_MOUNT_FAIL);
	});

	it('should use document root for onDomAlive when scope is global', () => {
		const host = document.createElement('div');
		host.id = 'global-alive-host';
		document.body.appendChild(host);

		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});
		taskContext.set(
			'global-alive-task',
			createArtifactTask({
				taskId: 'global-alive-task',
				taskStatus: 'idle',
				artifactName: 'GlobalAliveComp',
				injectAt: '#global-alive-host',
				artifact: createVueComponent('GlobalAliveComp'),
				alive: true,
				isObserver: false,
				scope: 'global'
			})
		);

		onTargetReady(runtime, host, 'global-alive-task');

		expect(aliveSpy).toHaveBeenCalledOnce();
		expect(aliveSpy.mock.calls[0][4]).toBe(document);
	});

	it('should call stopHandler when alive setup is cancelled during onDomAlive setup', () => {
		const host = document.createElement('div');
		host.id = 'stale-alive-host';
		document.body.appendChild(host);

		taskContext.set(
			'stale-alive-task',
			createArtifactTask({
				taskId: 'stale-alive-task',
				taskStatus: 'idle',
				artifactName: 'StaleAliveComp',
				injectAt: '#stale-alive-host',
				artifact: createVueComponent('StaleAliveComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		const stopHandler = vi.fn();
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(() => {
			const ctx = taskContext.get<ArtifactTask>('stale-alive-task');
			if (ctx) {
				ctx.alive = false;
			}
			return stopHandler;
		});

		onTargetReady(runtime, host, 'stale-alive-task');

		expect(stopHandler).toHaveBeenCalledOnce();
		expect(taskContext.get<ArtifactTask>('stale-alive-task')?.isObserver).toBe(false);
	});

	it('should assign alive observer handler immediately when setup succeeds', () => {
		const host = document.createElement('div');
		host.id = 'cancel-alive-host';
		document.body.appendChild(host);

		const stopHandler = vi.fn();
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);
		taskContext.set(
			'cancel-alive-task',
			createArtifactTask({
				taskId: 'cancel-alive-task',
				taskStatus: 'idle',
				artifactName: 'CancelAliveComp',
				injectAt: '#cancel-alive-host',
				artifact: createVueComponent('CancelAliveComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		onTargetReady(runtime, host, 'cancel-alive-task');
		const context = taskContext.get<ArtifactTask>('cancel-alive-task');

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(context?.disableAlive).toBe(stopHandler);
		expect(context?.isObserver).toBe(true);
	});

	it('should call reset and onTargetReady from onDomAlive callbacks', () => {
		const host = document.createElement('div');
		host.id = 'alive-callback-host';
		document.body.appendChild(host);

		taskContext.set(
			'alive-callback-task',
			createArtifactTask({
				taskId: 'alive-callback-task',
				taskStatus: 'idle',
				artifactName: 'AliveCallbackComp',
				injectAt: '#alive-callback-host',
				artifact: createVueComponent('AliveCallbackComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		const resetSpy = vi.spyOn(taskContext, 'reset');
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(
			(_matchedElement, _injectAt, onRemove, onRestore) => {
				onRemove();
				const ctx = taskContext.get<ArtifactTask>('alive-callback-task');
				if (ctx) {
					ctx.alive = false;
				}
				onRestore(document.createElement('div'));
				return () => {};
			}
		);

		onTargetReady(runtime, host, 'alive-callback-task');

		expect(resetSpy).toHaveBeenCalledWith('alive-callback-task');
		expect(taskContext.get('alive-callback-task')?.taskStatus).toBe('active');
	});
	it('should set Task`s timeout config correctly', async () => {
		const onDomReadySpy = vi.spyOn(DOMWatcher, 'onDomReady');
		taskContext.set(
			'timeout-task',
			createArtifactTask({
				taskId: 'timeout-task',
				taskStatus: 'idle',
				timeout: 5000
			})
		);
		taskContext.taskRecords.push({ taskId: 'timeout-task', injectAt: '#app' });

		startTasks(runtime, getRegisteredTaskIds());

		expect(onDomReadySpy).toHaveBeenCalledWith(
			'#app',
			expect.any(Function),
			document,
			{
				once: true,
				timeout: 5000
			},
			expect.objectContaining({
				logger: expect.anything(),
				emit: expect.any(Function)
			})
		);
	});
});
