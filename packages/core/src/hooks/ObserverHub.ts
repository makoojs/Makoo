import { ErrorCode } from '../error/ErrorCode';
import { formatMakooError } from '../error/formatMakooError';
import { MakooError } from '../error/MakooError';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import type {
	ObserveEvent,
	ObserveEventName,
	ObserveHook,
	ObserverHub,
	PropagationCtrl,
	PropagationState
} from './types';
import { createPropagationState } from './util';

export function createObserverHub(logger: ILogger = new Logger()): ObserverHub {
	const eventHooks: Map<ObserveEventName, Set<ObserveHook>> = new Map();
	const taskHooks: Map<string, Map<ObserveEventName, Set<ObserveHook>>> = new Map();
	const anyHooks: Set<ObserveHook> = new Set();

	function off(event: ObserveEventName, hook?: ObserveHook): void {
		if (hook) {
			const hooks = eventHooks.get(event);
			if (!hooks) return;
			hooks.delete(hook);
			if (hooks.size === 0) {
				eventHooks.delete(event);
			}
		} else {
			eventHooks.delete(event);
		}
	}

	function offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void {
		const hookMap = taskHooks.get(taskId);
		if (!hookMap) return;

		if (!event) {
			taskHooks.delete(taskId);
			return;
		}

		if (!hook) {
			hookMap.delete(event);
			if (hookMap.size === 0) {
				taskHooks.delete(taskId);
			}
			return;
		}

		const hooks = hookMap.get(event);
		if (!hooks) return;

		hooks.delete(hook);
		if (hooks.size === 0) {
			hookMap.delete(event);
		}

		if (hookMap.size === 0) {
			taskHooks.delete(taskId);
		}
	}

	function offAny(hook: ObserveHook): void {
		anyHooks.delete(hook);
	}

	function dispatchHooks(
		hooks: Set<ObserveHook> | undefined,
		event: ObserveEvent,
		propagation: PropagationState
	): void {
		if (!hooks || hooks.size === 0) return;
		for (const hook of [...hooks]) {
			if (propagation.isImmediatePropagationStopped()) return;
			callSafely(hook, event, propagation.ctrl);
		}
	}

	function callSafely(hook: ObserveHook, event: ObserveEvent, ctrl: PropagationCtrl): void {
		try {
			hook(event, ctrl);
		} catch (error) {
			const hookError =
				error instanceof MakooError
					? error
					: new MakooError(
							`Hook execution failed for event "${event.name}"`,
							undefined,
							ErrorCode.HOOK_EXECUTION_FAIL,
							error instanceof Error ? error : new Error(String(error))
						);
			hookError.withContext({
				event: event.name,
				taskId: event.taskId ?? null
			});
			logger.error(formatMakooError(hookError));
		}
	}

	function emitOnTask(taskId: string, event: ObserveEvent): void {
		const normalized = event.taskId === taskId ? event : { ...event, taskId };

		const taskScoped = taskHooks.get(taskId)?.get(normalized.name);
		const scoped = eventHooks.get(normalized.name);
		const hasTaskScopedHooks = Boolean(taskScoped && taskScoped.size > 0);
		const hasScopedHooks = Boolean(scoped && scoped.size > 0);

		if (!hasTaskScopedHooks && !hasScopedHooks && anyHooks.size === 0) return;

		const propagation = createPropagationState();
		dispatchHooks(taskScoped, normalized, propagation);
		if (propagation.isPropagationStopped()) return;
		dispatchHooks(scoped, normalized, propagation);
		if (propagation.isPropagationStopped()) return;
		dispatchHooks(anyHooks, normalized, propagation);
	}

	return {
		on(event, hook) {
			if (!eventHooks.has(event)) {
				eventHooks.set(event, new Set());
			}
			eventHooks.get(event)?.add(hook);

			return () => {
				off(event, hook);
			};
		},
		onTask(taskId, event, hook) {
			if (!taskHooks.has(taskId)) {
				taskHooks.set(taskId, new Map());
			}

			const hookMap = taskHooks.get(taskId);
			if (!hookMap?.has(event)) {
				hookMap?.set(event, new Set());
			}

			hookMap?.get(event)?.add(hook);

			return () => {
				offTask(taskId, event, hook);
			};
		},
		onAny(hook) {
			anyHooks.add(hook);

			return () => {
				offAny(hook);
			};
		},
		off,
		offTask,
		offAny,
		clear() {
			eventHooks.clear();
			anyHooks.clear();
			taskHooks.clear();
		},
		hasHooks(event) {
			if (event) {
				const hooks = eventHooks.get(event);
				if (hooks && hooks.size > 0) return true;
				if (anyHooks.size > 0) return true;

				for (const hookMap of taskHooks.values()) {
					const taskHooksForEvent = hookMap.get(event);
					if (taskHooksForEvent && taskHooksForEvent.size > 0) {
						return true;
					}
				}

				return false;
			}

			if (anyHooks.size > 0) return true;
			for (const hooks of eventHooks.values()) {
				if (hooks.size > 0) return true;
			}

			for (const hookMap of taskHooks.values()) {
				for (const hooks of hookMap.values()) {
					if (hooks.size > 0) return true;
				}
			}

			return false;
		},
		emit(event) {
			// task hook? -> event hook -> any hook
			if (event.taskId) {
				emitOnTask(event.taskId, event);
				return;
			}

			const propagation = createPropagationState();
			dispatchHooks(eventHooks.get(event.name), event, propagation);
			if (propagation.isPropagationStopped()) return;
			dispatchHooks(anyHooks, event, propagation);
		},
		emitOnTask
	};
}
