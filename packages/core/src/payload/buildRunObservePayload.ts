import type { ObserveEvent } from '../hooks/types';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type RunObserveEventName =
	| 'start:requested'
	| 'start:taskScheduled'
	| 'start:taskSkipped'
	| 'task:targetReady';

type RunObserveTaskBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
};

type RunObserveInputByName = {
	'start:requested': {
		totalTasks: number;
		idleTasks: number;
		pendingTasks: number;
		activeTasks: number;
	};
	'start:taskScheduled': Omit<RunObserveTaskBase, 'status'> & {
		status: 'pending';
		preStatus: 'idle';
		timeout: number;
	};
	'start:taskSkipped': RunObserveTaskBase & {
		status: 'active' | 'pending';
		skipReason: 'already-active' | 'already-pending';
	};
	'task:targetReady': RunObserveTaskBase;
};

type RunObservePayloadByName = {
	'start:requested': Omit<ObserveEvent, 'name' | 'ts'> & {
		meta: {
			totalTasks: number;
			idleTasks: number;
			pendingTasks: number;
			activeTasks: number;
		};
	};
	'start:taskScheduled': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		status: 'pending';
		preStatus: 'idle';
		meta: {
			timeout: number;
		};
	};
	'start:taskSkipped': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		status: 'active' | 'pending';
		meta: {
			skipReason: 'already-active' | 'already-pending';
		};
	};
	'task:targetReady': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
	};
};

const runObservePayloadBuilders = {
	'start:requested': (input) => ({
		meta: {
			totalTasks: input.totalTasks,
			idleTasks: input.idleTasks,
			pendingTasks: input.pendingTasks,
			activeTasks: input.activeTasks
		}
	}),
	'start:taskScheduled': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		preStatus: input.preStatus,
		meta: {
			timeout: input.timeout
		}
	}),
	'start:taskSkipped': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			skipReason: input.skipReason
		}
	}),
	'task:targetReady': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status
	})
} satisfies ObservePayloadBuilderMap<
	RunObserveEventName,
	RunObserveInputByName,
	RunObservePayloadByName
>;

export function buildRunObservePayload<T extends RunObserveEventName>(
	name: T,
	input: RunObserveInputByName[T]
): RunObservePayloadByName[T] {
	return buildObservePayload(name, input, runObservePayloadBuilders);
}
