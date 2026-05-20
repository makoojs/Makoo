import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObserverHub } from '../src/hooks/ObserverHub';
import { Injector } from '../src/Injector/Injector';
import { Action } from '../src/Injector/types';
import { Logger } from '../src/logger/Logger';
import { createActivityStore } from '../src/signal/observeActivitySignal';
import { TaskContext } from '../src/Task/TaskContext';
import type { TaskLifeCycle } from '../src/Task/TaskLifeCycle';
import type { TaskRegister } from '../src/Task/TaskRegister';
import type { TaskRunner } from '../src/Task/TaskRunner';
import type { ArtifactTask } from '../src/Task/types';
import { DOMWatcher } from '../src/watcher/DomWatcher';
import { createReactAdapter } from '../../react/src/ReactAdapter';
import type { ReactMountArtifact } from '../../react/src/type';
import { createVueAdapter } from '../../vue/src/VueAdapter';
import { VuePlugin } from '../../vue/src/VuePlugin';
import { createVueComponent } from './factory/TaskFactor';

const reactDomClientMock = vi.hoisted(() => {
	const root = {
		render: vi.fn(),
		unmount: vi.fn()
	};
	return {
		root,
		createRoot: vi.fn(() => root)
	};
});

vi.mock('react-dom/client', () => ({
	createRoot: reactDomClientMock.createRoot
}));

function createInjector(config?: ConstructorParameters<typeof Injector>[0]): Injector {
	const injector = new Injector(config);
	return injector.applyAdapter(createVueAdapter());
}

describe('Injector', () => {
	let injector: Injector;
	let taskContext: TaskContext;
	let taskRegister: TaskRegister;
	let taskRunner: TaskRunner;
	let taskLifeCycle: TaskLifeCycle;

	beforeEach(() => {
		VuePlugin.clear();
		injector = createInjector();
		const internals = injector as unknown as {
			taskContext: TaskContext;
			taskRegister: TaskRegister;
			taskRunner: TaskRunner;
			taskLifeCycle: TaskLifeCycle;
		};
		taskContext = internals.taskContext;
		taskRegister = internals.taskRegister;
		taskRunner = internals.taskRunner;
		taskLifeCycle = internals.taskLifeCycle;
		document.body.innerHTML = '';
		reactDomClientMock.createRoot.mockClear();
		reactDomClientMock.root.render.mockClear();
		reactDomClientMock.root.unmount.mockClear();
		vi.restoreAllMocks();
	});

	it('should create injector and keep default config', () => {
		expect(injector).toBeInstanceOf(Injector);
	});

	it('should forward register to TaskRegister and wrap lifecycle callbacks', () => {
		const registerSpy = vi.spyOn(taskRegister, 'register');
		const enableSpy = vi.spyOn(taskLifeCycle, 'enableAlive').mockImplementation(() => {});
		const disableSpy = vi.spyOn(taskLifeCycle, 'disableAlive').mockImplementation(() => {});
		const component = createVueComponent('FacadeComp');

		const result = injector.register('#app', component);

		expect(registerSpy).toHaveBeenCalledWith('#app', component, undefined);
		result.enableAlive();
		result.disableAlive();
		expect(enableSpy).toHaveBeenCalledWith(result.taskId);
		expect(disableSpy).toHaveBeenCalledWith(result.taskId);
	});

	it('should forward register to TaskRegister and wrap lifecycle callbacks', () => {
		const registerSpy = vi.spyOn(taskRegister, 'register');
		const enableSpy = vi.spyOn(taskLifeCycle, 'enableAlive').mockImplementation(() => {});
		const disableSpy = vi.spyOn(taskLifeCycle, 'disableAlive').mockImplementation(() => {});
		const artifact = createVueComponent('artifact');
		const adapter = {
			name: 'plain',
			mount: vi.fn(() => ({ handle: {} })),
			unmount: vi.fn()
		};

		const result = injector.register('#artifact-app', artifact);

		expect(registerSpy).toHaveBeenCalledWith('#artifact-app', artifact, undefined);
		result.enableAlive();
		result.disableAlive();
		expect(enableSpy).toHaveBeenCalledWith(result.taskId);
		expect(disableSpy).toHaveBeenCalledWith(result.taskId);
	});

	it('should forward registerListener to TaskRegister', () => {
		const spy = vi.spyOn(taskRegister, 'registerListener');
		const cb = vi.fn();

		injector.registerListener('#btn', 'click', cb);

		expect(spy).toHaveBeenCalledWith('#btn', 'click', cb, undefined);
	});

	it('should forward run to TaskRunner', () => {
		const runSpy = vi.spyOn(taskRunner, 'run').mockImplementation(() => {});
		injector.run();
		expect(runSpy).toHaveBeenCalledOnce();
	});

	it('should forward enableAlive and disableAlive to TaskLifeCycle', () => {
		const enableSpy = vi.spyOn(taskLifeCycle, 'enableAlive').mockImplementation(() => {});
		const disableSpy = vi.spyOn(taskLifeCycle, 'disableAlive').mockImplementation(() => {});

		injector.enableAlive('task-a');
		injector.disableAlive('task-a');

		expect(enableSpy).toHaveBeenCalledWith('task-a');
		expect(disableSpy).toHaveBeenCalledWith('task-a');
	});

	it('should forward bindListenerSignal and controlListener to TaskRunner', () => {
		const source = createActivityStore(true);
		const bindSpy = vi.spyOn(taskRunner, 'bindListenerSignal').mockReturnValue(true);
		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);

		injector.bindListenerSignal('task-b', source);
		injector.controlListener('task-b', Action.OPEN);

		expect(bindSpy).toHaveBeenCalledWith('task-b', source);
		expect(controlSpy).toHaveBeenCalledWith('task-b', Action.OPEN);
	});

	it('should get task context', () => {
		const context = injector.getContext();
		expect(context).toBeDefined();
		expect(context).toBeInstanceOf(TaskContext);
		expect(taskContext).toBe(context);
	});

	it('should set timeout in global config', () => {
		const onDomReadySpy = vi.spyOn(DOMWatcher, 'onDomReady');
		const testInjector = createInjector({ timeout: 10000 });
		testInjector.register('#app', createVueComponent('AppComp'));
		testInjector.run();

		expect(onDomReadySpy).toHaveBeenCalledWith(
			'#app',
			expect.any(Function),
			document,
			{
				once: true,
				timeout: 10000
			},
			expect.objectContaining({
				logger: expect.anything(),
				emit: expect.any(Function)
			})
		);
	});

	it('should run task with custom timeout', () => {
		const onDomReadySpy = vi.spyOn(DOMWatcher, 'onDomReady');
		const testInjector = createInjector();
		testInjector.register('#app', createVueComponent('AppComp'), {
			timeout: 5000
		});
		testInjector.run();

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

	it('should register shared plugins in VuePlugin', () => {
		const pluginA = { install: vi.fn() };
		const pluginB = { install: vi.fn() };

		VuePlugin.use(pluginA);
		VuePlugin.usePlugins(pluginB);

		expect(VuePlugin.getPlugins()).toEqual([pluginA, pluginB]);
	});

	it('should register custom adapters per injector instance', () => {
		const host = document.createElement('div');
		host.id = 'custom-adapter';
		document.body.appendChild(host);
		const artifact = { kind: 'custom-artifact', name: 'CustomArtifact' };
		const mount = vi.fn(() => ({ handle: { mounted: true }, instance: artifact }));
		const unmount = vi.fn();

		const result = injector
			.applyAdapter({
				name: 'custom',
				matches(candidate): candidate is typeof artifact {
					return candidate === artifact;
				},
				mount,
				unmount
			})
			.register('#custom-adapter', artifact);

		injector.run();

		const context = taskContext.get<ArtifactTask>(result.taskId);
		expect(context?.taskStatus).toBe('active');
		expect(context?.adapter.name).toBe('custom');
		expect(mount).toHaveBeenCalledOnce();
		expect(context?.appRoot?.parentElement).toBe(host);
	});

	it('should mount and unmount React elements through React adapter', () => {
		const host = document.createElement('div');
		host.id = 'react-adapter';
		document.body.appendChild(host);
		const artifact: ReactMountArtifact = createElement('span', null, 'Badge');
		const result = injector
			.applyAdapter(createReactAdapter())
			.register('#react-adapter', artifact);

		injector.run();

		const context = taskContext.get<ArtifactTask>(result.taskId);
		expect(context?.taskStatus).toBe('active');
		expect(context?.adapter.name).toBe('react');
		expect(reactDomClientMock.createRoot).toHaveBeenCalledWith(context?.appRoot);
		expect(reactDomClientMock.root.render).toHaveBeenCalledWith(artifact);

		injector.destroy(result.taskId);

		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
	});

	it('should reset task context', () => {
		injector.register('#reset', createVueComponent('ResetComp'));
		injector.reset('task-a');
		const context = taskContext.get('task-a');
		expect(context).toBeUndefined();
	});

	it('should reset all task contexts', () => {
		injector.register('#reset', createVueComponent('ResetComp'));
		injector.register('#reset', createVueComponent('ResetComp2'));
		injector.register('#reset', createVueComponent('ResetComp3'));
		injector.resetAll();
		expect([...taskContext.keys()]).toHaveLength(3);
	});

	it('should destroy task context', () => {
		injector.register('#destroy', createVueComponent('DestroyComp'));
		injector.destroy('task-destroy');
		const context = taskContext.get('task-destroy');
		expect(context).toBeUndefined();
	});

	it('should destroy all task contexts', () => {
		injector.register('#destroy', createVueComponent('DestroyComp'));
		injector.register('#destroy', createVueComponent('DestroyComp2'));
		injector.register('#destroy', createVueComponent('DestroyComp3'));
		injector.destroyAll();
		expect([...taskContext.keys()]).toHaveLength(0);
	});

	it('should pass integration smoke: register + run activates task and mounts component', () => {
		const host = document.createElement('div');
		host.id = 'smoke';
		document.body.appendChild(host);

		const { taskId } = injector.register('#smoke', createVueComponent('SmokeComp'));
		injector.run();

		const context = taskContext.get<ArtifactTask>(taskId);
		expect(context?.taskStatus).toBe('active');
		expect(context?.mountHandle).toBeDefined();
		expect(context?.appRoot?.parentElement).toBe(host);
	});

	it('should pass integration smoke for register with a non-Vue adapter', () => {
		const host = document.createElement('div');
		host.id = 'artifact-smoke';
		document.body.appendChild(host);

		const artifact = createVueComponent('artifact');
		const { taskId } = injector.register('#artifact-smoke', artifact);

		injector.run();

		const context = taskContext.get<ArtifactTask>(taskId);
		expect(context?.taskStatus).toBe('active');
		expect(context?.artifactName).toBe('artifact');
		expect(context?.artifact).toBe(artifact);
		expect(context?.mountHandle).toBeDefined();
		expect(context?.instance).toBeDefined();
		expect(context?.appRoot?.parentElement).toBe(host);

		injector.destroy(taskId);

		expect(context?.mountHandle).toBeUndefined();
		expect(context?.instance).toBeUndefined();
		expect(context?.appRoot).toBeUndefined();
		expect(taskContext.get(taskId)).toBeUndefined();
	});

	it('should expose ObserverHub and receive integration events', () => {
		const observer = new ObserverHub();
		const observedInjector = createInjector({ observer });
		const events: string[] = [];
		observer.onAny((event) => {
			events.push(event.name);
		});

		const host = document.createElement('div');
		host.id = 'obs-smoke';
		document.body.appendChild(host);

		observedInjector.register('#obs-smoke', {
			...createVueComponent('ObservedComp')
		});
		observedInjector.run();

		expect(observedInjector.getObserver()).toBe(observer);
		expect(events).toContain('register:start');
		expect(events).toContain('register:success');
		expect(events).toContain('run:start');
		expect(events).toContain('task:targetReady');
		expect(events).toContain('artifact:mountSuccess');
	});

	it('should register hooks from config and expose observer facade methods', () => {
		const injectSuccessHook = vi.fn();
		const afterDestroyHook = vi.fn();
		const anyHook = vi.fn();
		const taskHook = vi.fn();
		const hookedInjector = createInjector({
			hooks: {
				'artifact:mountSuccess': injectSuccessHook,
				'task:afterDestroy': [afterDestroyHook]
			}
		});

		const offAny = hookedInjector.onAny(anyHook);
		const offFail = hookedInjector.on('artifact:mountFail', vi.fn());
		hookedInjector.onTask('hooked-host-task', 'artifact:mountSuccess', taskHook);

		const host = document.createElement('div');
		host.id = 'hooked-host';
		document.body.appendChild(host);

		const { taskId } = hookedInjector.register('#hooked-host', {
			...createVueComponent('HookedComp')
		});

		hookedInjector.offTask('hooked-host-task');
		hookedInjector.onTask(taskId, 'artifact:mountSuccess', taskHook);

		hookedInjector.run();
		hookedInjector.destroy(taskId);
		offAny();
		offFail();

		expect(injectSuccessHook).toHaveBeenCalledOnce();
		expect(afterDestroyHook).toHaveBeenCalledOnce();
		expect(anyHook).toHaveBeenCalled();
		expect(taskHook).toHaveBeenCalledOnce();
	});
	it('should get the logger', () => {
		const logger = new Logger();
		const testInjector = createInjector({ logger });
		expect(testInjector.getLogger()).toBe(logger);
	});
});
