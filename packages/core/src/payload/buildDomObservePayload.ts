import type { ObserveEvent } from '../hooks/types';
import type { TaskKind } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type DomObserveEventName =
	| 'dom:targetFound'
	| 'dom:targetTimeout'
	| 'dom:targetRemoved'
	| 'dom:targetRestored';

type DomObserveBase = {
	injectAt: string;
	taskId: string;
	kind: TaskKind;
};

type DomObserveInputByName = {
	'dom:targetFound': DomObserveBase & {
		durationMs: number;
		root: 'document' | 'element';
	};
	'dom:targetTimeout': DomObserveBase & {
		durationMs: number;
		root: 'document' | 'element';
	};
	'dom:targetRemoved': DomObserveBase;
	'dom:targetRestored': DomObserveBase & {
		durationMs: number;
	};
};

type DomObservePayloadByName = {
	'dom:targetFound': Omit<ObserveEvent, 'name' | 'ts'> & {
		durationMs: number;
		meta: {
			root: 'document' | 'element';
		};
	};
	'dom:targetTimeout': Omit<ObserveEvent, 'name' | 'ts'> & {
		durationMs: number;
		meta: {
			root: 'document' | 'element';
		};
	};
	'dom:targetRemoved': Omit<ObserveEvent, 'name' | 'ts'> & {
		meta: {
			phase: 'removed';
		};
	};
	'dom:targetRestored': Omit<ObserveEvent, 'name' | 'ts'> & {
		durationMs: number;
	};
};

const domObservePayloadBuilders = {
	'dom:targetFound': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		durationMs: input.durationMs,
		meta: {
			root: input.root
		}
	}),
	'dom:targetTimeout': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		durationMs: input.durationMs,
		meta: {
			root: input.root
		}
	}),
	'dom:targetRemoved': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		meta: {
			phase: 'removed'
		}
	}),
	'dom:targetRestored': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		durationMs: input.durationMs
	})
} satisfies ObservePayloadBuilderMap<
	DomObserveEventName,
	DomObserveInputByName,
	DomObservePayloadByName
>;

export function buildDomObservePayload<T extends DomObserveEventName>(
	name: T,
	input: DomObserveInputByName[T]
): DomObservePayloadByName[T] {
	return buildObservePayload(name, input, domObservePayloadBuilders);
}
