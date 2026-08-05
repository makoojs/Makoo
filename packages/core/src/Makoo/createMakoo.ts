import { createRuntime } from '../runtime/createRuntime';
import type { MakooRuntimeState } from '../runtime/types';
import * as lifecycle from '../Task/TaskLifeCycle';
import { registerInjection, registerListener } from '../Task/TaskRegister';
import { controlListener, startTasks } from '../Task/TaskRunner';
import type {
	CreateMakooOptions,
	MakooInjectionDeclaration,
	MakooInjectionInput,
	MakooListenerDeclaration,
	MakooListenerInput,
	MakooRuntime,
	MakooTaskDeclaration,
	StartedComponentTask,
	StartedListenerTask,
	StartedTask,
	StartedTasks
} from './types';
import { Action } from './types';

export function createMakoo(options: CreateMakooOptions = {}): MakooRuntime {
	const runtime = createRuntime(options);

	return {
		start(tasks) {
			if (tasks.length === 0) {
				startTasks(runtime, []);
			}

			const startedTasks = registerDeclarations(runtime, tasks);
			if (startedTasks.length > 0) {
				startTasks(
					runtime,
					startedTasks.map((task) => task.taskId)
				);
			}
			return createStartedTasks(runtime, startedTasks);
		},
		reset: (taskId) => lifecycle.reset(runtime, taskId),
		destroy: (taskId) => lifecycle.destroy(runtime, taskId),
		resetAll: () => lifecycle.resetAll(runtime),
		destroyAll: () => lifecycle.destroyAll(runtime),
		enableAlive: (taskId) => lifecycle.enableAlive(runtime, taskId),
		disableAlive: (taskId) => lifecycle.disableAlive(runtime, taskId),
		on: (event, hook) => runtime.config.observer?.on(event, hook) ?? (() => {}),
		onTask: (taskId, event, hook) =>
			runtime.config.observer?.onTask(taskId, event, hook) ?? (() => {}),
		onAny: (hook) => runtime.config.observer?.onAny(hook) ?? (() => {}),
		off: (event, hook) => runtime.config.observer?.off(event, hook),
		offTask: (taskId, event, hook) => runtime.config.observer?.offTask(taskId, event, hook),
		offAny: (hook) => runtime.config.observer?.offAny(hook),
		getLogger: () => runtime.logger
	};
}

export function inject<TArtifact>(
	input: MakooInjectionInput<TArtifact>
): MakooInjectionDeclaration<TArtifact> {
	return {
		kind: 'component',
		...(input.id ? { id: input.id } : {}),
		injectAt: input.injectAt,
		artifact: input.artifact,
		...(input.options ? { options: input.options } : {})
	};
}

export function listen(input: MakooListenerInput): MakooListenerDeclaration {
	return {
		kind: 'listener',
		...(input.id ? { id: input.id } : {}),
		listenAt: input.listenAt,
		event: input.type,
		type: input.type,
		callback: input.callback,
		...(typeof input.capture !== 'undefined' ? { capture: input.capture } : {}),
		...(input.activitySignal ? { activitySignal: input.activitySignal } : {})
	};
}

function registerDeclarations(
	runtime: MakooRuntimeState,
	declarations: MakooTaskDeclaration[]
): StartedTask[] {
	const startedTasks: StartedTask[] = [];

	for (const declaration of declarations) {
		if (declaration.kind === 'component') {
			const result = registerInjection(runtime, {
				...(declaration.id ? { id: declaration.id } : {}),
				injectAt: declaration.injectAt,
				artifact: declaration.artifact,
				...(declaration.options ? { options: declaration.options } : {})
			});
			if (result.isSuccess && !result.isDuplicate) {
				startedTasks.push(createComponentTask(runtime, result.taskId));
			}
			continue;
		}

		const result = registerListener(runtime, declaration);
		if (result.isSuccess && !result.isDuplicate) {
			startedTasks.push(createListenerTask(runtime, result.taskId));
		}
	}

	return startedTasks;
}

function createStartedTasks(runtime: MakooRuntimeState, tasks: StartedTask[]): StartedTasks {
	const taskMap = new Map(tasks.map((task) => [task.taskId, task]));

	return {
		tasks,
		get(taskId) {
			return runtime.taskContext.has(taskId) ? taskMap.get(taskId) : undefined;
		},
		resetAll() {
			for (const task of tasks) {
				if (runtime.taskContext.has(task.taskId)) {
					lifecycle.reset(runtime, task.taskId);
				}
			}
		},
		destroyAll() {
			for (const task of tasks) {
				if (runtime.taskContext.has(task.taskId)) {
					lifecycle.destroy(runtime, task.taskId);
				}
			}
		}
	};
}

function createComponentTask(runtime: MakooRuntimeState, taskId: string): StartedComponentTask {
	return {
		kind: 'component',
		taskId,
		enableAlive: () => lifecycle.enableAlive(runtime, taskId),
		disableAlive: () => lifecycle.disableAlive(runtime, taskId),
		reset: () => lifecycle.reset(runtime, taskId),
		destroy: () => lifecycle.destroy(runtime, taskId)
	};
}

function createListenerTask(runtime: MakooRuntimeState, taskId: string): StartedListenerTask {
	return {
		kind: 'listener',
		taskId,
		open: () => controlListener(runtime, taskId, Action.OPEN),
		close: () => controlListener(runtime, taskId, Action.CLOSE),
		destroy: () => lifecycle.destroy(runtime, taskId)
	};
}
