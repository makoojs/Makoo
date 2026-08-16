import { AdapterError } from '../error/AdapterError';
import { ErrorCode } from '../error/ErrorCode';
import { formatMakooError } from '../error/formatMakooError';
import { SignalError } from '../error/SignalError';
import { TaskError } from '../error/TaskError';
import type { ActionEvent } from '../Makoo/types';
import { Action } from '../Makoo/types';
import { buildAliveObservePayload } from '../payload/buildAliveObservePayload';
import { buildInjectObservePayload } from '../payload/buildInjectObservePayload';
import { buildListenerObservePayload } from '../payload/buildListenerObservePayload';
import { buildRunObservePayload } from '../payload/buildRunObservePayload';
import { createDomObserveEmitFactory } from '../payload/createDomObserveEmitFactory';
import type { MakooRuntimeState } from '../runtime/types';
import { observeActivitySignal, stopActivitySignal } from '../signal/observeActivitySignal';
import type { ActivitySignalSource } from '../signal/types';
import { UUID } from '../util/uuid';
import { DOMWatcher } from '../watcher/DomWatcher';
import type { _InjectResult, Task, TaskListenerFeature, TaskRecord } from './types';
import { getTaskInjectAt, getTaskListener, isArtifactTask } from './util';

export function startTasks(runtime: MakooRuntimeState, taskIds: string[]): void {
	const taskIdSet = new Set(taskIds);
	const taskRecords: TaskRecord[] = runtime.taskContext.taskRecords.filter(({ taskId }) =>
		taskIdSet.has(taskId)
	);

	const startStats = taskRecords.reduce(
		(acc, { taskId }) => {
			const status = runtime.taskContext.getTaskStatus(taskId);
			if (status === 'idle') acc.idleTasks += 1;
			if (status === 'pending') acc.pendingTasks += 1;
			if (status === 'active') acc.activeTasks += 1;
			return acc;
		},
		{
			totalTasks: taskRecords.length,
			idleTasks: 0,
			pendingTasks: 0,
			activeTasks: 0
		}
	);

	runtime.emit('start:requested', buildRunObservePayload('start:requested', startStats));
	if (taskRecords.length === 0) {
		throw new TaskError(
			'No registered tasks found, call start() with tasks before starting',
			[],
			ErrorCode.TASK_NO_REGISTERED
		);
	}

	taskRecords.forEach(({ taskId: id, injectAt }) => {
		const status: 'idle' | 'pending' | 'active' | undefined =
			runtime.taskContext.getTaskStatus(id);
		const task: Task | undefined = runtime.taskContext.get(id);

		if (!task || !status) return;
		if (status === 'active' || status === 'pending') {
			runtime.emit(
				'start:taskSkipped',
				buildRunObservePayload('start:taskSkipped', {
					taskId: id,
					kind: task.kind,
					injectAt,
					status,
					skipReason: status === 'active' ? 'already-active' : 'already-pending'
				})
			);
			return;
		}

		DOMWatcher.onDomReady(
			injectAt,
			(el): void => onTargetReady(runtime, el, id),
			document,
			{
				once: true,
				timeout: task.timeout
			},
			{
				logger: runtime.logger,
				emit: createDomObserveEmitFactory({
					emit: runtime.emit,
					taskId: id,
					kind: task.kind,
					injectAt,
					root: document
				})
			}
		);
		if (runtime.taskContext.getTaskStatus(id) !== 'active') {
			runtime.taskContext.setTaskStatus(id, 'pending');
			runtime.emit(
				'start:taskScheduled',
				buildRunObservePayload('start:taskScheduled', {
					taskId: id,
					kind: task.kind,
					injectAt,
					status: 'pending',
					preStatus: 'idle',
					timeout: task.timeout
				})
			);
		}
	});
}

export function onTargetReady(
	runtime: MakooRuntimeState,
	targetElement: HTMLElement,
	taskId: string
): void {
	const context = runtime.taskContext.get(taskId);
	if (!context) {
		const error = new TaskError(
			'Task not found, unable to proceed with injection',
			undefined,
			ErrorCode.TASK_NOT_FOUND
		).withContext({ taskId });
		runtime.logger.error(formatMakooError(error));
		return;
	}

	runtime.emit(
		'task:targetReady',
		buildRunObservePayload('task:targetReady', {
			taskId,
			kind: context.kind,
			injectAt: getTaskInjectAt(context),
			status: context.taskStatus
		})
	);

	if (context.taskStatus === 'active') {
		return;
	}
	const injectAt: string = getTaskInjectAt(context);

	if (isArtifactTask(context)) {
		runtime.emit(
			'artifact:mountStart',
			buildInjectObservePayload('artifact:mountStart', {
				taskId,
				kind: 'component',
				injectAt: context.injectAt,
				status: context.taskStatus,
				artifactName: context.artifactName,
				alive: context.alive,
				scope: context.scope,
				withEvent: context.withEvent
			})
		);
		const result: _InjectResult = injectArtifact(runtime, targetElement, taskId);
		if (!result.isSuccess) {
			runtime.taskContext.setTaskStatus(taskId, 'idle');
			runtime.emit(
				'artifact:mountFail',
				buildInjectObservePayload('artifact:mountFail', {
					taskId,
					kind: 'component',
					injectAt: context.injectAt,
					status: 'idle',
					error:
						result.error ??
						new TaskError(
							`Component inject failed for task "${taskId}"`,
							[{ path: 'taskId', message: taskId }],
							ErrorCode.TASK_INJECT_FAIL
						),
					artifactName: context.artifactName
				})
			);
			return;
		}
		runtime.emit(
			'artifact:mountSuccess',
			buildInjectObservePayload('artifact:mountSuccess', {
				taskId,
				kind: 'component',
				injectAt: context.injectAt,
				status: context.taskStatus,
				artifactName: context.artifactName,
				alive: context.alive,
				scope: context.scope
			})
		);
	}

	if (context.withEvent) {
		let result: boolean | null = null;
		const listener: TaskListenerFeature | undefined = getTaskListener(context);
		if (listener?.activitySignal) {
			result = bindListenerSignal(runtime, taskId, listener.activitySignal());
		} else {
			result = controlListener(runtime, taskId, Action.OPEN);
		}

		if (result === false) {
			runtime.taskContext.setTaskStatus(taskId, 'idle');
			const listener = getTaskListener(context);
			runtime.emit(
				'listener:attachFail',
				buildListenerObservePayload('listener:attachFail', {
					taskId,
					kind: context.kind,
					injectAt,
					status: 'idle',
					error: new TaskError(
						`Listener attach failed for task "${taskId}"`,
						[{ path: 'taskId', message: taskId }],
						ErrorCode.TASK_LISTENER_ATTACH_FAIL
					),
					listenerEvent: listener?.event,
					listenAt: listener?.listenAt
				})
			);
			return;
		}
	}

	runtime.taskContext.setTaskStatus(taskId, 'active');
}

export function bindListenerSignal(
	runtime: MakooRuntimeState,
	taskId: string,
	source: ActivitySignalSource<boolean>
): boolean {
	const context: Task | undefined = runtime.taskContext.get(taskId);
	if (!context) {
		const error = new TaskError(
			'Task not found, unable to bind activity signal',
			undefined,
			ErrorCode.TASK_NOT_FOUND
		).withContext({ taskId, signal: 'activitySignal' });
		runtime.logger.error(formatMakooError(error));
		return false;
	}

	if (context.watcher) {
		stopActivitySignal(context.watcher.watcher);
		context.watcher = undefined;
	}

	try {
		const unWatch = observeActivitySignal(source, (newSignal) => {
			controlListener(runtime, taskId, newSignal ? Action.OPEN : Action.CLOSE);
		});

		context.watcher = {
			watcher: unWatch,
			watchSource: source
		};
		return true;
	} catch (error) {
		const signalError =
			error instanceof SignalError
				? error
				: new SignalError(
						'Failed to bind activity signal',
						undefined,
						ErrorCode.TASK_SIGNAL_BIND_FAIL,
						error instanceof Error ? error : new Error(String(error))
					);
		signalError.withContext({ taskId, signal: 'activitySignal' });
		runtime.logger.error(formatMakooError(signalError));
		return false;
	}
}

export function controlListener(
	runtime: MakooRuntimeState,
	taskId: string,
	event: ActionEvent
): boolean {
	const context: Task | undefined = runtime.taskContext.get(taskId);
	if (!context) {
		const error = new TaskError(
			'Task not found, unable to manage listener state',
			undefined,
			ErrorCode.TASK_NOT_FOUND
		).withContext({ taskId });
		runtime.logger.error(formatMakooError(error));
		return false;
	}
	const listener = getTaskListener(context);

	if (!listener) {
		runtime.logger.warn(`Task "${taskId}" has no event binding configured`);
		return false;
	}

	switch (event) {
		case Action.OPEN: {
			if (listener.controller) {
				return false;
			}

			const newController = attachEvent(
				runtime,
				taskId,
				context.kind,
				listener.listenAt,
				listener.event,
				listener.callback,
				listener.capture
			);

			if (newController) {
				listener.controller = newController;
				runtime.emit(
					'listener:attached',
					buildListenerObservePayload('listener:attached', {
						taskId,
						kind: context.kind,
						injectAt: listener.listenAt,
						status: context.taskStatus,
						listenerEvent: listener.event,
						listenAt: listener.listenAt
					})
				);
			} else {
				const error = new TaskError(
					`Failed to attach event "${listener.event}" for task "${taskId}"`,
					undefined,
					ErrorCode.TASK_LISTENER_ATTACH_FAIL
				).withContext({
					taskId,
					event: listener.event,
					listenAt: listener.listenAt
				});
				runtime.logger.error(formatMakooError(error));
				runtime.emit(
					'listener:attachFail',
					buildListenerObservePayload('listener:attachFail', {
						taskId,
						kind: context.kind,
						injectAt: listener.listenAt,
						status: context.taskStatus,
						error,
						listenerEvent: listener.event,
						listenAt: listener.listenAt
					})
				);
				return false;
			}
			break;
		}
		case Action.CLOSE: {
			if (!listener.controller) {
				return false;
			}

			listener.controller.abort();
			listener.controller = undefined;
			runtime.logger.info(`Event "${listener.event}" detached from task "${taskId}"`);
			runtime.emit(
				'listener:detached',
				buildListenerObservePayload('listener:detached', {
					taskId,
					kind: context.kind,
					injectAt: listener.listenAt,
					status: context.taskStatus,
					listenerEvent: listener.event,
					listenAt: listener.listenAt
				})
			);
			break;
		}

		default: {
			runtime.logger.warn(`Unknown action type "${event}" for task "${taskId}"`);
			return false;
		}
	}
	return true;
}

function attachEvent(
	runtime: MakooRuntimeState,
	id: string,
	kind: Task['kind'],
	listenAt: string,
	event: string,
	callback: EventListener,
	capture = false
): AbortController | null {
	const element = document.querySelector(listenAt) as HTMLElement;
	if (element) {
		const controller = new AbortController();
		element.addEventListener(event, callback, {
			capture,
			signal: controller.signal
		});
		runtime.logger.info(`Event "${event}" attached at "${listenAt}" (task: ${id})`);
		return controller;
	}

	const proxyController = new AbortController();
	DOMWatcher.onDomReady(
		listenAt,
		(el) => {
			if (proxyController.signal.aborted) return;
			el.addEventListener(event, callback, {
				capture,
				signal: proxyController.signal
			});
			runtime.logger.info(`Event "${event}" attached at "${listenAt}" (task: ${id})`);
		},
		document,
		{ once: true, timeout: runtime.config.timeout },
		{
			logger: runtime.logger,
			emit: createDomObserveEmitFactory({
				emit: runtime.emit,
				taskId: id,
				kind,
				injectAt: listenAt,
				root: document
			})
		}
	);

	return proxyController;
}

function injectArtifact(
	runtime: MakooRuntimeState,
	matchedElement: HTMLElement,
	taskId: string
): _InjectResult {
	const context: Task | undefined = runtime.taskContext.get(taskId);
	if (!context || !isArtifactTask(context)) {
		const error = new TaskError(
			`Task "${taskId}" context missing, injection aborted`,
			undefined,
			ErrorCode.TASK_NOT_FOUND
		).withContext({ taskId });
		runtime.logger.error(formatMakooError(error));
		return {
			isSuccess: false,
			error
		};
	}

	if (!context.taskId) {
		const error = new TaskError(
			`No artifact found for task "${taskId}", injection aborted`,
			undefined,
			ErrorCode.TASK_INJECT_FAIL
		).withContext({
			taskId,
			artifact: context.artifactName,
			injectAt: context.injectAt,
			adapter: context.adapter.name
		});
		runtime.logger.error(formatMakooError(error));
		return {
			isSuccess: false,
			error
		};
	}

	if (context.mountHandle) {
		const error = new TaskError(
			`Task "${taskId}" is already mounted, skipping`,
			undefined,
			ErrorCode.TASK_ALREADY_MOUNTED
		).withContext({
			taskId,
			artifact: context.artifactName,
			injectAt: context.injectAt,
			adapter: context.adapter.name
		});
		runtime.logger.warn(formatMakooError(error));
		return {
			isSuccess: false,
			error
		};
	}

	const injectAt: string = context.injectAt;
	const currentDocument = matchedElement.ownerDocument || document;

	const appRoot = currentDocument.createElement('div');
	appRoot.id = `implant-root-${UUID()}`;
	appRoot.style.display = 'contents';
	appRoot.style.zIndex = '999999';

	if (matchedElement.isConnected) {
		matchedElement.appendChild(appRoot);
	} else {
		const error = new TaskError(
			`Target element for task "${taskId}" is detached from DOM, injection skipped`,
			undefined,
			ErrorCode.TASK_TARGET_DETACHED
		).withContext({
			taskId,
			artifact: context.artifactName,
			injectAt: context.injectAt,
			adapter: context.adapter.name
		});
		runtime.logger.warn(formatMakooError(error));
		return {
			isSuccess: false,
			error
		};
	}

	try {
		const mountResult = context.adapter.mount({
			host: matchedElement,
			mountPoint: appRoot,
			artifact: context.artifact,
			taskId,
			injectAt,
			makoo: runtime.makooContext(taskId, injectAt)
		});

		context.mountHandle = mountResult.handle;
		context.hostElement = matchedElement;
		context.instance = mountResult.instance;
		context.appRoot = appRoot;

		runtime.logger.info(`Artifact "${context.artifactName}" injected at "${injectAt}"`);

		if (context.alive && !context.isObserver) {
			const stopHandler = DOMWatcher.onDomAlive(
				matchedElement,
				injectAt,
				() => {
					runtime.taskContext.reset(taskId);
				},
				(el): void => onTargetReady(runtime, el, taskId),
				context.scope === 'global' ? currentDocument : matchedElement,
				{
					once: true,
					timeout: runtime.config.timeout
				},
				{
					logger: runtime.logger,
					emit: createDomObserveEmitFactory({
						emit: runtime.emit,
						taskId,
						kind: context.kind,
						injectAt,
						root: context.scope === 'global' ? currentDocument : matchedElement
					})
				}
			);

			if (!context.alive || context.mountHandle !== mountResult.handle) {
				stopHandler();
			} else {
				context.disableAlive = stopHandler;
				context.isObserver = true;
				runtime.emit(
					'alive:observerStarted',
					buildAliveObservePayload('alive:observerStarted', {
						taskId,
						kind: 'component',
						injectAt,
						status: context.taskStatus,
						scope: context.scope,
						observerMode: 'mounted'
					})
				);
				runtime.logger.info(`Task "${taskId}" alive observer activated`);
			}
		}

		return {
			isSuccess: true
		};
	} catch (error) {
		const adapterError =
			error instanceof AdapterError
				? error
				: new AdapterError(
						`Failed to mount artifact at "${injectAt}"`,
						undefined,
						ErrorCode.ADAPTER_MOUNT_FAIL,
						error instanceof Error ? error : new Error(String(error))
					);
		adapterError.withContext({
			taskId,
			artifact: context.artifactName,
			injectAt,
			adapter: context.adapter.name
		});
		runtime.logger.error(formatMakooError(adapterError));
		appRoot.remove();
		return {
			isSuccess: false,
			error: adapterError
		};
	}
}
