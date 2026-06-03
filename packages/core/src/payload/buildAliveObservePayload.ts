import type { ObserveEvent } from '../hooks/types';
import type { TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type AliveObserveEventName =
	| 'alive:enabled'
	| 'alive:disabled'
	| 'alive:observerStarted'
	| 'alive:observerStopped';

type AliveObserverMode = 'mounted' | 'await-target';

type AliveObserveBase = {
	taskId: string;
	kind: 'component';
	injectAt: string;
	status: TaskStatus;
	scope: 'local' | 'global';
};

type AliveObserveInputByName = {
	'alive:enabled': AliveObserveBase;
	'alive:disabled': AliveObserveBase;
	'alive:observerStarted': AliveObserveBase & { observerMode: AliveObserverMode };
	'alive:observerStopped': AliveObserveBase & { observerMode: AliveObserverMode };
};

type AliveObservePayloadByName = {
	'alive:enabled': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
		};
	};
	'alive:disabled': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
		};
	};
	'alive:observerStarted': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
			observerMode: AliveObserverMode;
		};
	};
	'alive:observerStopped': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
			observerMode: AliveObserverMode;
		};
	};
};

const aliveObservePayloadBuilders = {
	'alive:enabled': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope
		}
	}),
	'alive:disabled': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope
		}
	}),
	'alive:observerStarted': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope,
			observerMode: input.observerMode
		}
	}),
	'alive:observerStopped': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope,
			observerMode: input.observerMode
		}
	})
} satisfies ObservePayloadBuilderMap<
	AliveObserveEventName,
	AliveObserveInputByName,
	AliveObservePayloadByName
>;

export function buildAliveObservePayload<T extends AliveObserveEventName>(
	name: T,
	input: AliveObserveInputByName[T]
): AliveObservePayloadByName[T] {
	return buildObservePayload(name, input, aliveObservePayloadBuilders);
}
