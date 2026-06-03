import type { ObserveEmitter } from '../hooks/types';
import type { TaskKind } from '../Task/types';
import type { DomWatcherEmit } from '../watcher/types';
import { buildDomObservePayload } from './buildDomObservePayload';

type CreateDomObserveEmitFactoryInput = {
	emit: ObserveEmitter;
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	root: Document | HTMLElement;
};

export function createDomObserveEmitFactory(
	input: CreateDomObserveEmitFactoryInput
): DomWatcherEmit {
	const startedAt = Date.now();
	let removedAt: number | undefined;
	const root = input.root instanceof Document ? 'document' : 'element';

	return (name) => {
		if (name === 'dom:targetFound') {
			input.emit(
				'dom:targetFound',
				buildDomObservePayload('dom:targetFound', {
					injectAt: input.injectAt,
					taskId: input.taskId,
					kind: input.kind,
					durationMs: Date.now() - startedAt,
					root
				})
			);
			return;
		}

		if (name === 'dom:targetTimeout') {
			input.emit(
				'dom:targetTimeout',
				buildDomObservePayload('dom:targetTimeout', {
					injectAt: input.injectAt,
					taskId: input.taskId,
					kind: input.kind,
					durationMs: Date.now() - startedAt,
					root
				})
			);
			return;
		}

		if (name === 'dom:targetRemoved') {
			removedAt = Date.now();
			input.emit(
				'dom:targetRemoved',
				buildDomObservePayload('dom:targetRemoved', {
					injectAt: input.injectAt,
					taskId: input.taskId,
					kind: input.kind
				})
			);
			return;
		}

		input.emit(
			'dom:targetRestored',
			buildDomObservePayload('dom:targetRestored', {
				injectAt: input.injectAt,
				taskId: input.taskId,
				kind: input.kind,
				durationMs: Date.now() - (removedAt ?? startedAt)
			})
		);
	};
}
