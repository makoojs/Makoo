import type { AdapterRegistry, MakooContext } from '../adapter/types';
import type { ObserveEmitter } from '../hooks/types';
import type { ILogger } from '../logger/types';
import type { InjectionConfig } from '../Makoo/types';
import type { TaskContext } from '../Task/TaskContext';

export type MakooRuntimeState = {
	config: InjectionConfig;
	logger: ILogger;
	emit: ObserveEmitter;
	taskContext: TaskContext;
	adapterRegistry: AdapterRegistry;
	makooContext(taskId: string, injectAt: string): MakooContext;
};
