import type { ObserveEvent } from '../hooks/types';
import type { TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type InjectObserveEventName =
	| 'artifact:mountStart'
	| 'artifact:mountSuccess'
	| 'artifact:mountFail';

type InjectObserveBase = {
	taskId: string;
	kind: 'component';
	injectAt: string;
	status: TaskStatus;
	artifactName: string;
};

type InjectObserveInputByName = {
	'artifact:mountStart': InjectObserveBase & {
		alive: boolean;
		scope: 'local' | 'global';
		withEvent: boolean;
	};
	'artifact:mountSuccess': InjectObserveBase & {
		alive: boolean;
		scope: 'local' | 'global';
	};
	'artifact:mountFail': Omit<InjectObserveBase, 'status'> & {
		status: 'idle';
		error: unknown;
	};
};

type InjectObservePayloadByName = {
	'artifact:mountStart': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			artifactName: string;
			alive: boolean;
			scope: 'local' | 'global';
			withEvent: boolean;
		};
	};
	'artifact:mountSuccess': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			artifactName: string;
			alive: boolean;
			scope: 'local' | 'global';
		};
	};
	'artifact:mountFail': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		status: 'idle';
		error: unknown;
		meta: {
			artifactName: string;
		};
	};
};

const injectObservePayloadBuilders = {
	'artifact:mountStart': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			artifactName: input.artifactName,
			alive: input.alive,
			scope: input.scope,
			withEvent: input.withEvent
		}
	}),
	'artifact:mountSuccess': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			artifactName: input.artifactName,
			alive: input.alive,
			scope: input.scope
		}
	}),
	'artifact:mountFail': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: 'idle',
		error: input.error,
		meta: {
			artifactName: input.artifactName
		}
	})
} satisfies ObservePayloadBuilderMap<
	InjectObserveEventName,
	InjectObserveInputByName,
	InjectObservePayloadByName
>;

export function buildInjectObservePayload<T extends InjectObserveEventName>(
	name: T,
	input: InjectObserveInputByName[T]
): InjectObservePayloadByName[T] {
	return buildObservePayload(name, input, injectObservePayloadBuilders);
}
