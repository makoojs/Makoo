import type { ObserveEventName, ObserveHook } from '../hooks/types';
import type { ActionEvent } from '../Injector/types';
import type { ILogger } from '../logger/types';
import type { ActivitySignalSource } from '../signal/types';

export type AdapterUnmountReason = 'destroy' | 'reset' | 'remount' | 'manual';

export type MakooArtifactApi = {
	taskId: string;
	injectAt: string;
	enableAlive: () => void;
	disableAlive: () => void;
	reset: () => void;
	destroy: () => void;
	on: (event: ObserveEventName, hook: ObserveHook) => () => void;
	off: (event?: ObserveEventName, hook?: ObserveHook) => void;
	getLogger: () => ILogger;
	bindListenerSignal: (source: ActivitySignalSource<boolean>) => boolean;
	controlListener: (event: ActionEvent) => boolean;
};

export type AdapterMountInput<TArtifact = unknown> = {
	host: HTMLElement;
	mountPoint: HTMLElement;
	artifact: TArtifact;
	taskId: string;
	injectAt: string;
	makoo: MakooArtifactApi;
};

export type AdapterMountResult<THandle = unknown, TInstance = unknown> = {
	handle: THandle;
	instance?: TInstance;
};

export type AdapterUnmountInput<THandle = unknown> = {
	host?: HTMLElement;
	mountPoint: HTMLElement;
	handle: THandle;
	taskId: string;
	injectAt: string;
	reason: AdapterUnmountReason;
};

export interface MountAdapter<TArtifact = unknown, THandle = unknown, TInstance = unknown> {
	name: string;
	mount(input: AdapterMountInput<TArtifact>): AdapterMountResult<THandle, TInstance>;
	unmount(input: AdapterUnmountInput<THandle>): void;
}

export interface ResolvableMountAdapter<TArtifact = unknown, THandle = unknown, TInstance = unknown>
	extends MountAdapter<TArtifact, THandle, TInstance> {
	matches(artifact: unknown): artifact is TArtifact;
}

export type AdapterResolver = (artifact: unknown) => MountAdapter | undefined;
