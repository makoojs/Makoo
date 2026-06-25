import { buildAliveObservePayload } from '../payload/buildAliveObservePayload';
import { buildTaskObservePayload } from '../payload/buildTaskObservePayload';
import { createDomObserveEmitFactory } from '../payload/createDomObserveEmitFactory';
import type { MakooRuntimeState } from '../runtime/types';
import { DOMWatcher } from '../watcher/DomWatcher';
import { onTargetReady } from './TaskRunner';
import type { Task } from './types';
import { getTaskInjectAt, isArtifactTask } from './util';

export function enableAlive(runtime: MakooRuntimeState, taskId: string): void {
	const context = runtime.taskContext.get(taskId);
	if (!context) {
		runtime.logger.error(`Task "${taskId}" not found`);
		return;
	}

	if (!isArtifactTask(context)) {
		runtime.logger.warn(`enableAlive is not applicable to non-component task "${taskId}"`);
		return;
	}

	if (context.alive && context.isObserver) {
		runtime.logger.warn(`Task "${taskId}" already has an active alive observer`);
		return;
	}

	context.alive = true;
	context.isObserver = false;
	runtime.emit(
		'alive:enabled',
		buildAliveObservePayload('alive:enabled', {
			taskId,
			kind: 'component',
			injectAt: context.injectAt,
			status: context.taskStatus,
			scope: context.scope
		})
	);
	context.disableAlive = () => {};

	if (context.mountHandle && context.appRoot?.isConnected) {
		const matchedElement = context.hostElement ?? context.appRoot.parentElement;
		if (!matchedElement) {
			runtime.logger.warn(
				`Task "${taskId}": host element not found, unable to activate alive observer`
			);
			return;
		}

		const currentDocument = matchedElement.ownerDocument || document;
		const injectAt = context.injectAt;

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
					kind: 'component',
					injectAt,
					root: context.scope === 'global' ? currentDocument : matchedElement
				})
			}
		);

		if (!context.alive) {
			stopHandler();
			return;
		}
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
		return;
	}

	if (context.mountHandle && !context.appRoot?.isConnected) {
		runtime.taskContext.reset(taskId);
	}

	if (!context.mountHandle) {
		let cancelled = false;
		const stopReadyObserver = DOMWatcher.onDomReady(
			context.injectAt,
			(el): void => {
				if (cancelled || !context.alive) {
					runtime.logger.warn(
						`Task "${taskId}" alive state changed before element appears`
					);
					return;
				}
				onTargetReady(runtime, el, taskId);
			},
			document,
			{ once: true, timeout: runtime.config.timeout },
			{
				logger: runtime.logger,
				emit: createDomObserveEmitFactory({
					emit: runtime.emit,
					taskId,
					kind: 'component',
					injectAt: context.injectAt,
					root: document
				})
			}
		);
		context.disableAlive = () => {
			if (cancelled) return;
			cancelled = true;
			runtime.emit(
				'alive:observerStopped',
				buildAliveObservePayload('alive:observerStopped', {
					taskId,
					kind: 'component',
					injectAt: context.injectAt,
					status: context.taskStatus,
					scope: context.scope,
					observerMode: 'await-target'
				})
			);
			stopReadyObserver();
		};
		context.isObserver = true;
		runtime.emit(
			'alive:observerStarted',
			buildAliveObservePayload('alive:observerStarted', {
				taskId,
				kind: 'component',
				injectAt: context.injectAt,
				status: context.taskStatus,
				scope: context.scope,
				observerMode: 'await-target'
			})
		);
		runtime.logger.info(`Task "${taskId}" awaiting target element for re-injection`);
	}
}

export function disableAlive(runtime: MakooRuntimeState, taskId: string): void {
	const context = runtime.taskContext.get(taskId);

	if (!context) {
		runtime.logger.error(`Task "${taskId}" not found`);
		return;
	}

	if (!isArtifactTask(context)) {
		runtime.logger.warn(`disableAlive is not applicable to non-component task "${taskId}"`);
		return;
	}

	if (!context.alive) {
		runtime.logger.warn(`Task "${taskId}" has no active alive observer to stop`);
		return;
	}

	const stopHandler = context.disableAlive;
	context.alive = false;
	context.isObserver = false;
	context.disableAlive = undefined;
	stopHandler?.();
	runtime.emit(
		'alive:disabled',
		buildAliveObservePayload('alive:disabled', {
			taskId,
			kind: 'component',
			injectAt: context.injectAt,
			status: context.taskStatus,
			scope: context.scope
		})
	);
	runtime.emit(
		'alive:observerStopped',
		buildAliveObservePayload('alive:observerStopped', {
			taskId,
			kind: 'component',
			injectAt: context.injectAt,
			status: context.taskStatus,
			scope: context.scope,
			observerMode: context.mountHandle ? 'mounted' : 'await-target'
		})
	);
}

export function destroy(runtime: MakooRuntimeState, taskId: string): void {
	const context: Task | undefined = runtime.taskContext.get(taskId);
	if (!context) {
		runtime.logger.error(`Task ${taskId} not found`);
		return;
	}

	const preStatus = context.taskStatus;
	const injectAt = getTaskInjectAt(context);
	runtime.emit(
		'task:beforeDestroy',
		buildTaskObservePayload('task:beforeDestroy', {
			taskId,
			kind: context.kind,
			injectAt,
			status: preStatus
		})
	);
	if (isArtifactTask(context) && context.alive) {
		disableAlive(runtime, taskId);
	}
	runtime.taskContext.destroy(taskId);
	runtime.emit(
		'task:afterDestroy',
		buildTaskObservePayload('task:afterDestroy', {
			taskId,
			kind: context.kind,
			injectAt,
			preStatus
		})
	);
}

export function destroyAll(runtime: MakooRuntimeState): void {
	for (const id of runtime.taskContext.keys()) {
		const context: Task | undefined = runtime.taskContext.get(id);
		if (context && isArtifactTask(context) && context.alive) {
			disableAlive(runtime, id);
		}
	}
	runtime.taskContext.destroyAll();
}

export function reset(runtime: MakooRuntimeState, taskId: string): void {
	const context: Task | undefined = runtime.taskContext.get(taskId);
	if (!context) {
		runtime.logger.error(`Task ${taskId} not found`);
		return;
	}

	const preStatus = context.taskStatus;
	const injectAt = getTaskInjectAt(context);
	runtime.emit(
		'task:beforeReset',
		buildTaskObservePayload('task:beforeReset', {
			taskId,
			kind: context.kind,
			injectAt,
			status: preStatus
		})
	);
	if (isArtifactTask(context) && context.alive) {
		disableAlive(runtime, taskId);
	}
	runtime.taskContext.reset(taskId);
	runtime.emit(
		'task:afterReset',
		buildTaskObservePayload('task:afterReset', {
			taskId,
			kind: context.kind,
			injectAt,
			status: context.taskStatus,
			preStatus
		})
	);
}

export function resetAll(runtime: MakooRuntimeState): void {
	for (const id of runtime.taskContext.keys()) {
		const context: Task | undefined = runtime.taskContext.get(id);
		if (context && isArtifactTask(context) && context.alive) {
			disableAlive(runtime, id);
		}
	}
	runtime.taskContext.resetAll();
}
