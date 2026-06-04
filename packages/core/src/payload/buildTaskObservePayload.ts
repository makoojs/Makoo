import type { ObserveEvent } from '../hooks/types';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type TaskObserveEventName =
	| 'task:statusChange'
	| 'task:beforeReset'
	| 'task:afterReset'
	| 'task:beforeDestroy'
	| 'task:afterDestroy';

type TaskObserveBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
};

type TaskObserveInputByName = {
	'task:statusChange': TaskObserveBase & {
		preStatus: TaskStatus;
	};
	'task:beforeReset': TaskObserveBase;
	'task:afterReset': TaskObserveBase & {
		preStatus: TaskStatus;
	};
	'task:beforeDestroy': TaskObserveBase;
	'task:afterDestroy': Omit<TaskObserveBase, 'status'> & {
		preStatus: TaskStatus;
	};
};

type TaskObservePayloadByName = {
	'task:statusChange': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		preStatus: TaskStatus;
	};
	'task:beforeReset': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
	};
	'task:afterReset': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		preStatus: TaskStatus;
	};
	'task:beforeDestroy': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
	};
	'task:afterDestroy': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		preStatus: TaskStatus;
	};
};

const taskObservePayloadBuilders = {
	'task:statusChange': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		preStatus: input.preStatus
	}),
	'task:beforeReset': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status
	}),
	'task:afterReset': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		preStatus: input.preStatus
	}),
	'task:beforeDestroy': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status
	}),
	'task:afterDestroy': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		preStatus: input.preStatus
	})
} satisfies ObservePayloadBuilderMap<
	TaskObserveEventName,
	TaskObserveInputByName,
	TaskObservePayloadByName
>;

export function buildTaskObservePayload<T extends TaskObserveEventName>(
	name: T,
	input: TaskObserveInputByName[T]
): TaskObservePayloadByName[T] {
	return buildObservePayload(name, input, taskObservePayloadBuilders);
}
