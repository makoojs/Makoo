import type { ResolvableMountAdapter } from '../adapter/types';
import type { LifecycleHookMap, ObserveEventName, ObserveHook, ObserverHub } from '../hooks/types';
import type { ILogger } from '../logger/types';
import type { TaskActivitySignal } from '../Task/types';

export enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}

export type ActionEvent = `${Action}`;

export type MakooListenerOptions = {
	activitySignal?: TaskActivitySignal;
};

export type MakooListenerInput = {
	id?: string;
	listenAt: string;
	type: string;
	callback: EventListener;
	activitySignal?: TaskActivitySignal;
};

export type MakooListenerDeclaration = {
	kind: 'listener';
	id?: string;
	listenAt: string;
	event: string;
	type: string;
	callback: EventListener;
	activitySignal?: TaskActivitySignal;
};

export type ArtifactOptions = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	on?: MakooListenerDeclaration;
	hooks?: LifecycleHookMap;
};

export type MakooInjectionInput<TArtifact = unknown> = {
	id?: string;
	injectAt: string;
	artifact: TArtifact;
	options?: ArtifactOptions;
};

export type MakooInjectionDeclaration<TArtifact = unknown> = {
	kind: 'component';
	id?: string;
	injectAt: string;
	artifact: TArtifact;
	options?: ArtifactOptions;
};

export type MakooTaskDeclaration<TArtifact = unknown> =
	| MakooInjectionDeclaration<TArtifact>
	| MakooListenerDeclaration;

export type MakooDefaults = {
	alive: boolean;
	scope: 'local' | 'global';
	timeout: number;
};

export type InjectionConfig = MakooDefaults & {
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};

export type CreateMakooOptions = {
	defaults?: Partial<MakooDefaults>;
	adapters?: ResolvableMountAdapter[];
	hooks?: LifecycleHookMap;
	logger?: ILogger;
	observer?: ObserverHub;
};

export type StartedComponentTask = {
	kind: 'component';
	taskId: string;
	enableAlive(): void;
	disableAlive(): void;
	reset(): void;
	destroy(): void;
};

export type StartedListenerTask = {
	kind: 'listener';
	taskId: string;
	open(): boolean;
	close(): boolean;
	destroy(): void;
};

export type StartedTask = StartedComponentTask | StartedListenerTask;

export type StartedTasks = {
	tasks: StartedTask[];
	get(taskId: string): StartedTask | undefined;
	resetAll(): void;
	destroyAll(): void;
};

export type MakooRuntime = {
	start(tasks: MakooTaskDeclaration[]): StartedTasks;
	reset(taskId: string): void;
	destroy(taskId: string): void;
	resetAll(): void;
	destroyAll(): void;
	enableAlive(taskId: string): void;
	disableAlive(taskId: string): void;
	on(event: ObserveEventName, hook: ObserveHook): () => void;
	onTask(taskId: string, event: ObserveEventName, hook: ObserveHook): () => void;
	onAny(hook: ObserveHook): () => void;
	off(event: ObserveEventName, hook?: ObserveHook): void;
	offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void;
	offAny(hook: ObserveHook): void;
	getLogger(): ILogger;
};
