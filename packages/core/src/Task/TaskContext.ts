import { AdapterError } from '../error/AdapterError';
import { ErrorCode } from '../error/ErrorCode';
import { formatMakooError } from '../error/formatMakooError';
import { SignalError } from '../error/SignalError';
import { TaskError } from '../error/TaskError';
import type { ObserveEmitter } from '../hooks/types';
import { noopObserveEmitter } from '../hooks/util';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { buildResourceObservePayload } from '../payload/buildResourceObservePayload';
import { buildTaskObservePayload } from '../payload/buildTaskObservePayload';
import { stopActivitySignal } from '../signal/observeActivitySignal';
import type {
	ArtifactTask,
	ListenerTask,
	Task,
	TaskErrorMessage,
	TaskKind,
	TaskListenerFeature,
	TaskRecord,
	TaskStatus
} from './types';
import { getTaskInjectAt, getTaskListener, isArtifactTask } from './util';

export type TaskContext = {
	taskErrorMessages: TaskErrorMessage[];
	taskRecords: TaskRecord[];
	set(key: string, context: Task): void;
	get(key: string, kind: 'listener'): ListenerTask | undefined;
	get(key: string, kind: 'component'): ArtifactTask | undefined;
	get<T extends Task>(key: string): T | undefined;
	get(key: string): Task | undefined;
	has(key: string): boolean;
	keys(): IterableIterator<string>;
	getTaskStatus(id: string): TaskStatus | undefined;
	setTaskStatus(id: string, status: TaskStatus): void;
	destroy(id: string): void;
	destroyAll(): void;
	releaseComponentInstance(id: string): void;
	releaseDomElement(id: string): void;
	releaseListener(id: string): void;
	releaseWatcher(id: string): void;
	reset(id: string): void;
	resetAll(): void;
};

export function createTaskContext(
	emit: ObserveEmitter = noopObserveEmitter,
	logger: ILogger = new Logger()
): TaskContext {
	const contextMap: Map<string, Task> = new Map();

	function get(key: string, kind: 'listener'): ListenerTask | undefined;
	function get(key: string, kind: 'component'): ArtifactTask | undefined;
	function get<T extends Task>(key: string): T | undefined;
	function get(key: string): Task | undefined;
	function get(key: string, kind?: TaskKind): Task | undefined {
		const task = contextMap.get(key);
		if (!task) return undefined;

		if (kind) {
			return task.kind === kind ? task : undefined;
		}

		return task;
	}

	const taskContext: TaskContext = {
		taskErrorMessages: [],
		taskRecords: [],
		set(key, context) {
			contextMap.set(key, context);
		},
		get,
		has(key) {
			return contextMap.has(key);
		},
		keys() {
			return contextMap.keys();
		},
		getTaskStatus(id) {
			const task: Task | undefined = contextMap.get(id);
			return task ? task.taskStatus : undefined;
		},
		setTaskStatus(id, status) {
			const task: Task | undefined = contextMap.get(id);
			if (!task) {
				logger.warn(`Task "${id}" not found, may already be destroyed`);
				return;
			}
			if (task.taskStatus === status) {
				return;
			}
			const preStatus = task.taskStatus;
			task.taskStatus = status;
			const injectAt = getTaskInjectAt(task);

			emit(
				'task:statusChange',
				buildTaskObservePayload('task:statusChange', {
					taskId: id,
					kind: task.kind,
					injectAt,
					status,
					preStatus
				})
			);
		},
		destroy(id) {
			const context: Task | undefined = contextMap.get(id);
			if (!context) {
				logger.warn(`Task "${id}" not found, may already be destroyed`);
				return;
			}
			taskContext.setTaskStatus(id, 'idle');

			taskContext.taskRecords = taskContext.taskRecords.filter(
				(record) => record.taskId !== id
			);
			taskContext.taskErrorMessages = taskContext.taskErrorMessages.filter(
				(error) => error.taskId !== id
			);

			taskContext.releaseWatcher(id);
			taskContext.releaseListener(id);

			if (isArtifactTask(context)) {
				taskContext.releaseComponentInstance(id);
				taskContext.releaseDomElement(id);
			}

			contextMap.delete(id);
		},
		destroyAll() {
			const ids: string[] = Array.from(contextMap.keys());

			for (const id of ids) {
				taskContext.releaseWatcher(id);
			}

			for (const id of ids) {
				taskContext.releaseListener(id);

				const context = contextMap.get(id);
				if (context && isArtifactTask(context)) {
					taskContext.releaseComponentInstance(id);
					taskContext.releaseDomElement(id);
				}
			}

			contextMap.clear();
			taskContext.taskRecords = [];
			taskContext.taskErrorMessages = [];

			logger.info('All tasks destroyed');
		},
		releaseComponentInstance(id) {
			const context: Task | undefined = contextMap.get(id);
			if (context && isArtifactTask(context) && context.mountHandle && context.appRoot) {
				try {
					context.adapter.unmount({
						host: context.hostElement,
						mountPoint: context.appRoot,
						handle: context.mountHandle,
						taskId: id,
						injectAt: context.injectAt,
						reason: 'destroy'
					});
					context.mountHandle = undefined;
					context.instance = undefined;
					emit(
						'artifact:unmounted',
						buildResourceObservePayload('artifact:unmounted', {
							taskId: id,
							kind: 'component',
							injectAt: context.injectAt,
							status: context.taskStatus,
							artifactName: context.artifactName
						})
					);
				} catch (error) {
					const adapterError =
						error instanceof AdapterError
							? error
							: new AdapterError(
									'Failed to unmount component',
									undefined,
									ErrorCode.ADAPTER_UNMOUNT_FAIL,
									error instanceof Error ? error : new Error(String(error))
								).withContext({
									taskId: id,
									artifact: context.artifactName,
									injectAt: context.injectAt,
									adapter: context.adapter.name,
									reason: 'destroy'
								});
					logger.error(formatMakooError(adapterError));
				}
			} else {
				logger.warn(`Component for task "${id}" already unmounted`);
			}
		},
		releaseDomElement(id) {
			const context: Task | undefined = contextMap.get(id);
			if (!context || !isArtifactTask(context)) {
				logger.warn(`Task "${id}" context not found, unable to remove root element`);
				return;
			}
			if (!context.appRoot) {
				logger.warn(`Root element for task "${id}" not found, may already be removed`);
				return;
			}
			try {
				context.appRoot.remove();
				context.appRoot = undefined;
				context.hostElement = undefined;
			} catch (error) {
				const taskError = new TaskError(
					'Failed to remove component root element',
					undefined,
					ErrorCode.TASK_ROOT_REMOVE_FAIL,
					error instanceof Error ? error : new Error(String(error))
				).withContext({
					taskId: id,
					artifact: context.artifactName,
					injectAt: context.injectAt,
					adapter: context.adapter.name
				});
				logger.error(formatMakooError(taskError));
			}
		},
		releaseListener(id) {
			const context = contextMap.get(id);
			if (!context) return;
			const listener: TaskListenerFeature | undefined = getTaskListener(context);
			const listenerEvent: string | undefined =
				listener?.event ??
				(isArtifactTask(context) ? context.listener?.event : context.event);
			const listenAt: string | undefined =
				listener?.listenAt ??
				(isArtifactTask(context) ? context.listener?.listenAt : context.listenAt);

			if (listener?.controller) {
				try {
					listener.controller.abort();
				} catch (error) {
					const taskError = new TaskError(
						'Failed to abort task listener',
						undefined,
						ErrorCode.TASK_LISTENER_ABORT_FAIL,
						error instanceof Error ? error : new Error(String(error))
					).withContext({
						taskId: id,
						event: listenerEvent ?? null,
						listenAt: listenAt ?? null
					});
					logger.error(formatMakooError(taskError));
				}
			}

			if (listener) {
				listener.controller = undefined;
			}

			if (isArtifactTask(context)) {
				context.listener = undefined;
			}
			context.withEvent = false;
			emit(
				'resource:listenerReleased',
				buildResourceObservePayload('resource:listenerReleased', {
					taskId: id,
					kind: context.kind,
					injectAt: getTaskInjectAt(context),
					status: context.taskStatus,
					listenerEvent,
					listenAt
				})
			);
		},
		releaseWatcher(id) {
			const context = contextMap.get(id);
			if (context?.watcher) {
				try {
					stopActivitySignal(context.watcher.watcher);
					context.watcher = undefined;
					emit(
						'signal:watcherReleased',
						buildResourceObservePayload('signal:watcherReleased', {
							taskId: id,
							kind: context.kind,
							injectAt: getTaskInjectAt(context),
							status: context.taskStatus
						})
					);
				} catch (error) {
					const signalError = new SignalError(
						'Failed to stop activity signal watcher',
						undefined,
						ErrorCode.TASK_WATCHER_STOP_FAIL,
						error instanceof Error ? error : new Error(String(error))
					).withContext({
						taskId: id,
						signal: 'activitySignal',
						kind: context.kind,
						injectAt: getTaskInjectAt(context)
					});
					logger.error(formatMakooError(signalError));
				}
			}
		},
		reset(id) {
			const context = contextMap.get(id);
			if (!context) return;

			let didUnmountComponent = false;
			if (isArtifactTask(context) && context.mountHandle && context.appRoot) {
				try {
					context.adapter.unmount({
						host: context.hostElement,
						mountPoint: context.appRoot,
						handle: context.mountHandle,
						taskId: id,
						injectAt: context.injectAt,
						reason: 'reset'
					});
					didUnmountComponent = true;
				} catch (error) {
					const adapterError =
						error instanceof AdapterError
							? error
							: new AdapterError(
									'Failed to unmount component',
									undefined,
									ErrorCode.ADAPTER_UNMOUNT_FAIL,
									error instanceof Error ? error : new Error(String(error))
								).withContext({
									taskId: id,
									artifact: context.artifactName,
									injectAt: context.injectAt,
									adapter: context.adapter.name,
									reason: 'reset'
								});
					logger.warn(formatMakooError(adapterError));
				}
			}

			taskContext.setTaskStatus(id, 'idle');

			if (didUnmountComponent && isArtifactTask(context)) {
				emit(
					'artifact:unmounted',
					buildResourceObservePayload('artifact:unmounted', {
						taskId: id,
						kind: 'component',
						injectAt: context.injectAt,
						status: context.taskStatus,
						artifactName: context.artifactName
					})
				);
			}

			if (isArtifactTask(context)) {
				context.mountHandle = undefined;
				context.instance = undefined;
				context.hostElement = undefined;

				context.appRoot?.remove();
				context.appRoot = undefined;

				context.isObserver = false;
			}

			if (context.watcher) {
				taskContext.releaseWatcher(id);
			}

			const listener = getTaskListener(context);
			const listenerEvent = listener?.event;
			const listenAt = listener?.listenAt;
			if (listener?.controller) {
				listener.controller.abort();
				listener.controller = undefined;
			}
			if (listener) {
				emit(
					'resource:listenerReleased',
					buildResourceObservePayload('resource:listenerReleased', {
						taskId: id,
						kind: context.kind,
						injectAt: getTaskInjectAt(context),
						status: context.taskStatus,
						listenerEvent,
						listenAt
					})
				);
			}
		},
		resetAll() {
			for (const id of contextMap.keys()) {
				taskContext.reset(id);
			}
		}
	};

	return taskContext;
}
