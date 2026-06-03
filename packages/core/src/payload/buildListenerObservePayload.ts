import type { ObserveEvent } from '../hooks/types';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type ListenerObserveEventName = 'listener:attached' | 'listener:detached' | 'listener:attachFail';

type ListenerObserveBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
	listenerEvent?: string;
	listenAt?: string;
};

type ListenerObserveInputByName = {
	'listener:attached': ListenerObserveBase;
	'listener:detached': ListenerObserveBase;
	'listener:attachFail': ListenerObserveBase & { error: unknown };
};

type ListenerObservePayloadByName = {
	'listener:attached': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		meta: {
			listenerEvent?: string;
			listenAt?: string;
		};
	};
	'listener:detached': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		meta: {
			listenerEvent?: string;
			listenAt?: string;
		};
	};
	'listener:attachFail': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		error: unknown;
		meta: {
			listenerEvent?: string;
			listenAt?: string;
		};
	};
};

const listenerObservePayloadBuilders = {
	'listener:attached': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt
		}
	}),
	'listener:detached': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt
		}
	}),
	'listener:attachFail': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		error: input.error,
		meta: {
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt
		}
	})
} satisfies ObservePayloadBuilderMap<
	ListenerObserveEventName,
	ListenerObserveInputByName,
	ListenerObservePayloadByName
>;

export function buildListenerObservePayload<T extends ListenerObserveEventName>(
	name: T,
	input: ListenerObserveInputByName[T]
): ListenerObservePayloadByName[T] {
	return buildObservePayload(name, input, listenerObservePayloadBuilders);
}
