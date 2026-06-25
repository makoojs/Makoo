import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVueAdapter } from '../../vue/src/VueAdapter';
import { listen } from '../src';
import { createAdapterRegistry } from '../src/adapter/Adapter';
import type { MakooContext } from '../src/adapter/types';
import { AdapterError } from '../src/error/AdapterError';
import { ErrorCode } from '../src/error/ErrorCode';
import { createObserverHub } from '../src/hooks/ObserverHub';
import type { ObserveEvent } from '../src/hooks/types';
import { createObserveEmitter } from '../src/hooks/util';
import { Logger } from '../src/logger/Logger';
import type { MakooRuntimeState } from '../src/runtime/types';
import { createActivityStore } from '../src/signal/observeActivitySignal';
import { createTaskContext, type TaskContext } from '../src/Task/TaskContext';
import { registerInjection, registerListener } from '../src/Task/TaskRegister';
import type { ArtifactTask } from '../src/Task/types';
import { createTask, createVueComponent } from './factory/TaskFactor';

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

describe('TaskRegister', () => {
	let taskContext: TaskContext;
	let runtime: MakooRuntimeState;
	let vueAdapter: ReturnType<typeof createVueAdapter>;

	function createRuntime(observer = createObserverHub()): MakooRuntimeState {
		const logger = new Logger();
		const adapterRegistry = createAdapterRegistry();
		adapterRegistry.use(vueAdapter);

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
			adapterRegistry,
			makooContext: createMakooContext
		};
	}

	beforeEach(() => {
		const observer = createObserverHub();
		taskContext = createTaskContext();
		vueAdapter = createVueAdapter();
		runtime = createRuntime(observer);
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('should throw AdapterError with ADAPTER_NOT_FOUND when no adapter matches the artifact', () => {
		function UnknownArtifact() {
			return null;
		}
		expect(() =>
			registerInjection(runtime, { injectAt: '#target', artifact: UnknownArtifact })
		).toThrow(AdapterError);
		try {
			registerInjection(runtime, { injectAt: '#target', artifact: UnknownArtifact });
		} catch (err) {
			const e = err as AdapterError;
			expect(e.code).toBe(ErrorCode.ADAPTER_NOT_FOUND);
			expect(e.message).toContain('No adapter found for artifact');
		}
	});

	it('should match Vue component artifacts with explicit Vue features', () => {
		expect(vueAdapter.matches(createVueComponent('MatchedVue'))).toBe(true);
	});

	it('should not match plain function artifacts reserved for other adapters', () => {
		function ReactLikeBadge() {
			return null;
		}

		expect(vueAdapter.matches(ReactLikeBadge)).toBe(false);
	});

	it('should register a component task with defaults', () => {
		const component = createVueComponent('CompA');
		const result = registerInjection(runtime, { injectAt: '#app', artifact: component });
		const context = taskContext.get(result.taskId);

		expect(result).toEqual({ taskId: 'CompA@#app', isSuccess: true });
		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'CompA@#app',
			artifactName: 'CompA',
			injectAt: '#app',
			artifact: component,
			timeout: 5000,
			isObserver: false,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			}
		});
		expect(taskContext.taskRecords).toEqual([{ taskId: 'CompA@#app', injectAt: '#app' }]);
	});

	it('should use option override for alive and scope', () => {
		const component = createVueComponent('CompB');
		const result = registerInjection(runtime, {
			injectAt: '#root',
			artifact: component,
			options: { alive: true, scope: 'global' }
		});
		const context = taskContext.get(result.taskId);

		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'CompB@#root',
			artifactName: 'CompB',
			injectAt: '#root',
			artifact: component,
			alive: true,
			scope: 'global',
			timeout: 5000,
			isObserver: false,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			}
		});
	});

	it('should store event config and activity signal when provided', () => {
		const component = createVueComponent('CompC');
		const signal = createActivityStore(true);
		const activitySignal = () => signal;
		const callback = vi.fn();

		const result = registerInjection(runtime, {
			injectAt: '#event-host',
			artifact: component,
			options: {
				on: listen('#btn', 'click', callback, { activitySignal })
			}
		});

		const context = taskContext.get(result.taskId);
		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'CompC@#event-host',
			artifactName: 'CompC',
			injectAt: '#event-host',
			artifact: component,
			withEvent: true,
			timeout: 5000,
			isObserver: false,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			},
			listener: {
				listenAt: '#btn',
				event: 'click',
				callback,
				activitySignal
			}
		});
	});

	it('should register an artifact task with a custom adapter', () => {
		const artifact = createVueComponent('NativeBadge');

		const result = registerInjection(runtime, {
			injectAt: '#native-host',
			artifact,
			options: {
				alive: true,
				scope: 'global'
			}
		});
		const context = taskContext.get<ArtifactTask>(result.taskId);

		expect(result).toEqual({ taskId: 'NativeBadge@#native-host', isSuccess: true });
		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'NativeBadge@#native-host',
			artifactName: 'NativeBadge',
			injectAt: '#native-host',
			artifact,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			},
			alive: true,
			scope: 'global',
			timeout: 5000,
			isObserver: false
		});
	});

	it('should return existing result for duplicate component registration', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const component = createVueComponent('CompDup');
		const first = registerInjection(runtime, { injectAt: '#dup', artifact: component });
		const second = registerInjection(runtime, { injectAt: '#dup', artifact: component });

		expect(first).toEqual({ taskId: 'CompDup@#dup', isSuccess: true });
		expect(second).toEqual({
			taskId: 'CompDup@#dup',
			isSuccess: true,
			isDuplicate: true
		});
		expect(taskContext.taskRecords).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
	});

	it('should reuse generated anonymous name for same component reference', () => {
		const anonymous = createVueComponent('anonymous');
		const a = registerInjection(runtime, { injectAt: '#a', artifact: anonymous });
		const b = registerInjection(runtime, { injectAt: '#b', artifact: anonymous });

		expect(a.taskId.split('@')[0]).toBe(b.taskId.split('@')[0]);
	});

	it('should register listener-only task', () => {
		const callback = vi.fn();
		const result = registerListener(runtime, { listenAt: '#btn', event: 'click', callback });
		const context = taskContext.get(result.taskId);

		expect(result).toEqual({ taskId: 'listener-#btn-click', isSuccess: true });
		expect(context).toMatchObject(
			createTask({
				kind: 'listener',
				taskId: 'listener-#btn-click',
				listenAt: '#btn',
				event: 'click',
				callback,
				withEvent: true,
				timeout: 5000
			})
		);
	});

	it('should return existing result for duplicate listener registration', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const first = registerListener(runtime, {
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});
		const second = registerListener(runtime, {
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});

		expect(first).toEqual({ taskId: 'listener-#btn-click', isSuccess: true });
		expect(second).toEqual({
			taskId: 'listener-#btn-click',
			isSuccess: true,
			isDuplicate: true
		});
		expect(taskContext.taskRecords).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
	});

	it('should emit normalized register payloads for component registration', () => {
		const observer = createObserverHub();
		const runtimeWithObserver = createRuntime(observer);
		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		const component = createVueComponent('ObsComp');
		const first = registerInjection(runtimeWithObserver, {
			injectAt: '#obs',
			artifact: component
		});
		registerInjection(runtimeWithObserver, { injectAt: '#obs', artifact: component });

		expect(events).toHaveLength(4);

		expect(events[0]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle'
		});
		expect(events[0].meta).toEqual({
			artifactName: 'ObsComp',
			listenerEvent: undefined,
			listenAt: undefined,
			alive: false,
			scope: 'local',
			timeout: 5000,
			withEvent: false
		});

		expect(events[1]).toMatchObject({
			name: 'register:success',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle'
		});
		expect(events[1].meta).toEqual({
			artifactName: 'ObsComp',
			listenerEvent: undefined,
			listenAt: undefined,
			alive: false,
			scope: 'local',
			timeout: 5000,
			withEvent: false
		});

		expect(events[2]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle'
		});
		expect(events[2].meta).toEqual({
			artifactName: 'ObsComp',
			listenerEvent: undefined,
			listenAt: undefined,
			alive: false,
			scope: 'local',
			timeout: 5000,
			withEvent: false
		});

		expect(events[3]).toMatchObject({
			name: 'register:duplicate',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle',
			meta: {
				artifactName: 'ObsComp'
			}
		});
		expect(events[3].meta).toEqual({
			artifactName: 'ObsComp'
		});
	});

	it('should emit normalized register payloads for listener registration', () => {
		const observer = createObserverHub();
		const runtimeWithObserver = createRuntime(observer);
		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		const first = registerListener(runtimeWithObserver, {
			listenAt: '#btn-obs',
			event: 'click',
			callback: vi.fn()
		});
		registerListener(runtimeWithObserver, {
			listenAt: '#btn-obs',
			event: 'click',
			callback: vi.fn()
		});

		expect(events).toHaveLength(4);

		expect(events[0]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle'
		});
		expect(events[0].meta).toEqual({
			artifactName: undefined,
			listenerEvent: 'click',
			listenAt: '#btn-obs',
			alive: undefined,
			scope: undefined,
			timeout: undefined,
			withEvent: true
		});

		expect(events[1]).toMatchObject({
			name: 'register:success',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle'
		});
		expect(events[1].meta).toEqual({
			artifactName: undefined,
			listenerEvent: 'click',
			listenAt: '#btn-obs',
			alive: undefined,
			scope: undefined,
			timeout: undefined,
			withEvent: true
		});

		expect(events[2]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle'
		});
		expect(events[2].meta).toEqual({
			artifactName: undefined,
			listenerEvent: 'click',
			listenAt: '#btn-obs',
			alive: undefined,
			scope: undefined,
			timeout: undefined,
			withEvent: true
		});

		expect(events[3]).toMatchObject({
			name: 'register:duplicate',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle',
			meta: {
				listenerEvent: 'click'
			}
		});
		expect(events[3].meta).toEqual({
			listenerEvent: 'click'
		});
	});

	it('should emit register:error with normalized payload', () => {
		const observer = createObserverHub();
		const runtimeWithObserver = createRuntime(observer);

		vi.spyOn(taskContext, 'set').mockImplementation((_k, _v) => {
			throw new Error('set error');
		});

		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		registerInjection(runtimeWithObserver, {
			injectAt: '#obs',
			artifact: createVueComponent('ObsComp')
		});

		const errorEvent = events.find((event) => event.name === 'register:error');
		expect(errorEvent).toBeDefined();
		expect(errorEvent).toMatchObject({
			name: 'register:error',
			taskId: 'ObsComp@#obs',
			kind: 'component',
			injectAt: '#obs',
			status: 'idle',
			meta: {
				artifactName: 'ObsComp'
			}
		});
		expect(errorEvent?.error).toBeInstanceOf(Error);
	});

	it('should emit register:error with listener identity payload', () => {
		const observer = createObserverHub();
		const runtimeWithObserver = createRuntime(observer);

		vi.spyOn(taskContext, 'set').mockImplementation((_k, _v) => {
			throw new Error('set error');
		});

		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		registerListener(runtimeWithObserver, {
			listenAt: '#btn-obs',
			event: 'click',
			callback: vi.fn()
		});

		const errorEvent = events.find((event) => event.name === 'register:error');
		expect(errorEvent).toBeDefined();
		expect(errorEvent).toMatchObject({
			name: 'register:error',
			taskId: 'listener-#btn-obs-click',
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle',
			meta: {
				listenerEvent: 'click'
			}
		});
		expect(errorEvent?.error).toBeInstanceOf(Error);
	});
});
