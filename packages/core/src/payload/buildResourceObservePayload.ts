import type { ObserveEvent } from '../hooks/types';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type ResourceObserveEventName =
	| 'signal:watcherReleased'
	| 'resource:listenerReleased'
	| 'artifact:unmounted';

type ResourceObserveBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
};

type ResourceObserveInputByName = {
	'signal:watcherReleased': ResourceObserveBase;
	'resource:listenerReleased': ResourceObserveBase & {
		listenerEvent?: string;
		listenAt?: string;
	};
	'artifact:unmounted': Omit<ResourceObserveBase, 'kind'> & {
		kind: 'component';
		artifactName: string;
	};
};

type ResourceObservePayloadByName = {
	'signal:watcherReleased': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		meta: {
			resource: 'watcher';
		};
	};
	'resource:listenerReleased': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		meta: {
			resource: 'listener';
			listenerEvent?: string;
			listenAt?: string;
		};
	};
	'artifact:unmounted': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			resource: 'component';
			artifactName: string;
		};
	};
};

const resourceObservePayloadBuilders = {
	'signal:watcherReleased': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			resource: 'watcher'
		}
	}),
	'resource:listenerReleased': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			resource: 'listener',
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt
		}
	}),
	'artifact:unmounted': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			resource: 'component',
			artifactName: input.artifactName
		}
	})
} satisfies ObservePayloadBuilderMap<
	ResourceObserveEventName,
	ResourceObserveInputByName,
	ResourceObservePayloadByName
>;

export function buildResourceObservePayload<T extends ResourceObserveEventName>(
	name: T,
	input: ResourceObserveInputByName[T]
): ResourceObservePayloadByName[T] {
	return buildObservePayload(name, input, resourceObservePayloadBuilders);
}
