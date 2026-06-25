import type { TaskKind, TaskStatus } from '../Task/types';
export const OBSERVE_EVENT_NAMES = [
	'register:start',
	'register:success',
	'register:duplicate',
	'register:error',
	'start:requested',
	'start:taskScheduled',
	'start:taskSkipped',
	'artifact:mountStart',
	'artifact:mountSuccess',
	'artifact:mountFail',
	'listener:attached',
	'listener:detached',
	'listener:attachFail',
	'alive:enabled',
	'alive:disabled',
	'alive:observerStarted',
	'alive:observerStopped',
	'task:targetReady',
	'task:statusChange',
	'task:beforeReset',
	'task:afterReset',
	'task:beforeDestroy',
	'task:afterDestroy',
	'signal:watcherReleased',
	'resource:listenerReleased',
	'artifact:unmounted',
	'dom:targetFound',
	'dom:targetTimeout',
	'dom:targetRemoved',
	'dom:targetRestored'
] as const;

export type ObserverHub = {
	on(event: ObserveEventName, hook: ObserveHook): () => void;
	onTask(taskId: string, event: ObserveEventName, hook: ObserveHook): () => void;
	onAny(hook: ObserveHook): () => void;
	off(event: ObserveEventName, hook?: ObserveHook): void;
	offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void;
	offAny(hook: ObserveHook): void;
	clear(): void;
	hasHooks(event?: ObserveEventName): boolean;
	emit(event: ObserveEvent): void;
	emitOnTask(taskId: string, event: ObserveEvent): void;
};

export type ObserveEventName = (typeof OBSERVE_EVENT_NAMES)[number];

export type ObserveEvent = {
	name: ObserveEventName;
	ts: number;
	taskId?: string;
	kind?: TaskKind;
	injectAt?: string;
	status?: TaskStatus;
	durationMs?: number;
	error?: unknown;
	preStatus?: TaskStatus;
	meta?: Record<string, unknown>;
};
export type PropagationState = {
	ctrl: PropagationCtrl;
	isPropagationStopped(): boolean;
	isImmediatePropagationStopped(): boolean;
};

export type PropagationCtrl = {
	stopPropagation(): void;
	stopImmediatePropagation(): void;
};
export type ObserveHook = (event: ObserveEvent, ctrl: PropagationCtrl) => void;

export type LifecycleHookMap = Partial<Record<ObserveEventName, ObserveHook | ObserveHook[]>>;

export type ObserveEmitter = (
	name: ObserveEventName,
	payload?: Omit<ObserveEvent, 'name' | 'ts'>
) => void;
