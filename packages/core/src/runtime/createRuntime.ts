import { createAdapterRegistry } from '../adapter/Adapter';
import type { MakooContext } from '../adapter/types';
import { createObserverHub } from '../hooks/ObserverHub';
import type { ObserveEmitter } from '../hooks/types';
import { createObserveEmitter, registerHooks } from '../hooks/util';
import { Logger } from '../logger/Logger';
import type { CreateMakooOptions, InjectionConfig } from '../Makoo/types';
import { createTaskContext } from '../Task/TaskContext';
import * as lifecycle from '../Task/TaskLifeCycle';
import { bindListenerSignal, controlListener } from '../Task/TaskRunner';
import type { MakooRuntimeState } from './types';

const defaultConfig = {
	alive: false,
	scope: 'local' as const,
	timeout: 5000
};

export function createRuntime(options: CreateMakooOptions = {}): MakooRuntimeState {
	const logger = options.logger ?? new Logger();
	const observer = options.observer ?? createObserverHub(logger);
	const emit: ObserveEmitter = createObserveEmitter(observer);
	const taskContext = createTaskContext(emit, logger);
	const adapterRegistry = createAdapterRegistry();

	for (const adapter of options.adapters ?? []) {
		adapterRegistry.use(adapter);
	}

	const config: InjectionConfig = {
		...defaultConfig,
		...options.defaults,
		logger,
		observer,
		hooks: options.hooks
	};

	const runtime: MakooRuntimeState = {
		config,
		logger,
		emit,
		taskContext,
		adapterRegistry,
		makooContext(taskId, injectAt) {
			return createMakooContext(runtime, taskId, injectAt);
		}
	};

	registerHooks(observer, options.hooks);

	return runtime;
}

function createMakooContext(
	runtime: MakooRuntimeState,
	taskId: string,
	injectAt: string
): MakooContext {
	return {
		taskId,
		injectAt,
		enableAlive: () => lifecycle.enableAlive(runtime, taskId),
		disableAlive: () => lifecycle.disableAlive(runtime, taskId),
		reset: () => lifecycle.reset(runtime, taskId),
		destroy: () => lifecycle.destroy(runtime, taskId),
		on: (event, hook) => runtime.config.observer?.on(event, hook) ?? (() => {}),
		onTask: (event, hook) => runtime.config.observer?.onTask(taskId, event, hook) ?? (() => {}),
		off: (event, hook) => runtime.config.observer?.off(event, hook),
		offTask: (event, hook) => runtime.config.observer?.offTask(taskId, event, hook),
		getLogger: () => runtime.logger,
		bindListenerSignal: (source) => bindListenerSignal(runtime, taskId, source),
		controlListener: (event) => controlListener(runtime, taskId, event)
	};
}
