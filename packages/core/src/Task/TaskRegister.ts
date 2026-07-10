import { AdapterError } from '../error/AdapterError';
import { ErrorCode } from '../error/ErrorCode';
import { registerHooks } from '../hooks/util';
import type { ArtifactOptions } from '../Makoo/types';
import { buildRegisterObservePayload } from '../payload/buildRegisterObservePayload';
import type { MakooRuntimeState } from '../runtime/types';
import { getArtifactName } from '../util/getArtifactName';
import type {
	_RegisterResult,
	ArtifactTask,
	ListenerRegisterResult,
	Task,
	TaskActivitySignal,
	TaskListenerFeature
} from './types';
import { resolveInjectionTaskId } from './util';

export type InjectionDeclaration<TArtifact = unknown> = {
	id?: string;
	injectAt: string;
	artifact: TArtifact;
	options?: ArtifactOptions;
};

export type ListenerDeclaration = {
	id?: string;
	listenAt: string;
	event: string;
	callback: EventListener;
	activitySignal?: TaskActivitySignal;
};

export function registerListener(
	runtime: MakooRuntimeState,
	declaration: ListenerDeclaration
): ListenerRegisterResult {
	const { id: explicitId, listenAt, event, callback, activitySignal } = declaration;
	const id = explicitId ?? `listener-${listenAt}-${event}`;

	runtime.emit(
		'register:start',
		buildRegisterObservePayload('register:start', {
			taskId: id,
			kind: 'listener',
			injectAt: listenAt,
			status: 'idle',
			listenerEvent: event,
			listenAt,
			withEvent: true
		})
	);

	try {
		if (runtime.taskContext.has(id)) {
			runtime.logger.warn(`Listener "${id}" is already registered, skipping`);
			runtime.emit(
				'register:duplicate',
				buildRegisterObservePayload('register:duplicate', {
					taskId: id,
					kind: 'listener',
					injectAt: listenAt,
					status: runtime.taskContext.getTaskStatus(id) ?? 'idle',
					listenerEvent: event
				})
			);
			return {
				taskId: id,
				isSuccess: true,
				isDuplicate: true
			};
		}

		const context: Task = {
			taskId: id,
			kind: 'listener',
			taskStatus: 'idle',
			timeout: runtime.config.timeout,
			withEvent: true,
			listenAt,
			event,
			callback
		};
		if (activitySignal) {
			context.activitySignal = activitySignal;
		}

		runtime.taskContext.set(id, context);
		runtime.taskContext.taskRecords.push({ taskId: id, injectAt: listenAt });
		runtime.logger.info(`Listener "${id}" registered`);
		runtime.emit(
			'register:success',
			buildRegisterObservePayload('register:success', {
				taskId: id,
				kind: 'listener',
				injectAt: listenAt,
				status: 'idle',
				listenerEvent: event,
				listenAt,
				withEvent: true
			})
		);

		return {
			taskId: id,
			isSuccess: true
		};
	} catch (error) {
		runtime.emit(
			'register:error',
			buildRegisterObservePayload('register:error', {
				taskId: id,
				kind: 'listener',
				injectAt: listenAt,
				status: runtime.taskContext.getTaskStatus(id) ?? 'idle',
				error,
				listenerEvent: event
			})
		);
		return {
			taskId: id,
			isSuccess: false
		};
	}
}

export function registerInjection<TArtifact>(
	runtime: MakooRuntimeState,
	declaration: InjectionDeclaration<TArtifact>
): _RegisterResult {
	const { id, injectAt, artifact, options } = declaration;
	const artifactName = getArtifactName(artifact);
	const taskId = resolveInjectionTaskId(runtime, {
		id,
		artifactName,
		injectAt,
		artifact
	});
	const withEvent = Boolean(options?.on);
	const listenerEvent = options?.on?.type;
	const listenAt = options?.on?.listenAt;
	const alive = options?.alive ?? runtime.config.alive;
	const scope = options?.scope ?? runtime.config.scope;
	const timeout = options?.timeout ?? runtime.config.timeout;
	const mountAdapter = runtime.adapterRegistry.resolve(artifact);

	if (!mountAdapter) {
		throw new AdapterError(
			`No adapter found for artifact: ${artifactName}`,
			[{ path: 'artifact', message: artifactName }],
			ErrorCode.ADAPTER_NOT_FOUND
		);
	}

	runtime.emit(
		'register:start',
		buildRegisterObservePayload('register:start', {
			taskId,
			kind: 'component',
			injectAt,
			status: 'idle',
			artifactName,
			listenerEvent,
			listenAt,
			alive,
			scope,
			timeout,
			withEvent
		})
	);

	try {
		if (runtime.taskContext.has(taskId)) {
			runtime.logger.warn(`Task "${taskId}" is already registered, skipping`);
			runtime.emit(
				'register:duplicate',
				buildRegisterObservePayload('register:duplicate', {
					taskId,
					kind: 'component',
					injectAt,
					status: runtime.taskContext.getTaskStatus(taskId) ?? 'idle',
					artifactName
				})
			);
			return {
				taskId,
				isSuccess: true,
				isDuplicate: true
			};
		}

		const context: ArtifactTask<TArtifact> = {
			taskId,
			taskStatus: 'idle',
			kind: 'component',
			artifactName,
			injectAt,
			artifact,
			adapter: mountAdapter,
			withEvent: false,
			alive,
			scope,
			timeout,
			isObserver: false,
			hooks: options?.hooks
		};

		if (options?.on) {
			const listener: TaskListenerFeature = {
				listenAt: options.on.listenAt,
				event: options.on.type,
				callback: options.on.callback
			};
			context.withEvent = true;

			if (options.on.activitySignal) {
				listener.activitySignal = options.on.activitySignal;
			}

			context.listener = listener;
		}

		if (runtime.config.observer && options?.hooks) {
			registerHooks(runtime.config.observer, options.hooks, taskId);
		}

		runtime.taskContext.set(taskId, context as Task);
		runtime.taskContext.taskRecords.push({
			taskId,
			injectAt
		});

		runtime.logger.info(`Task "${taskId}" registered`);

		runtime.emit(
			'register:success',
			buildRegisterObservePayload('register:success', {
				taskId,
				kind: 'component',
				injectAt,
				status: 'idle',
				artifactName,
				listenerEvent,
				listenAt,
				alive,
				scope,
				timeout,
				withEvent
			})
		);

		return {
			taskId,
			isSuccess: true
		};
	} catch (error) {
		runtime.emit(
			'register:error',
			buildRegisterObservePayload('register:error', {
				taskId,
				kind: 'component',
				injectAt,
				status: runtime.taskContext.getTaskStatus(taskId) ?? 'idle',
				error,
				artifactName
			})
		);
		return {
			taskId,
			isSuccess: false
		};
	}
}
