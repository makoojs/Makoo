import type { ComponentStatus, ListenerStatus } from '@makoojs/core';

export type RuntimeOpen = {
	runtimeId: number;
};

export type SerializedMakooError = {
	code: string;
	message: string;
};

export type AttachedListenerSnapshot = {
	name: string;
	status: ListenerStatus;
};

export type InjectionSnapshot =
	| {
			name: string;
			kind: 'component';
			status: ComponentStatus;
			lastError?: SerializedMakooError;
			attachedListeners: AttachedListenerSnapshot[];
	  }
	| {
			name: string;
			kind: 'standalone-listener';
			status: ListenerStatus;
			lastError?: SerializedMakooError;
	  };

export type SerializedObservationNotice =
	| { type: 'injection-removed'; name: string }
	| { type: 'instance-disposed' }
	| { type: 'diagnostic'; name?: string; error: SerializedMakooError };

export type RuntimeInjection = {
	runtimeId: number;
	injection: InjectionSnapshot;
};

export type RuntimeNotice = {
	runtimeId: number;
	notice: SerializedObservationNotice;
};

export type TaskSnapshot = {
	taskId: string;
	kind: 'component' | 'listener';
	status: 'active' | 'pending' | 'idle';
	injectAt: string;
};

export type RuntimeSnapshot = {
	clientId: number;
	runtimeId: number;
	tasks: TaskSnapshot[];
};
