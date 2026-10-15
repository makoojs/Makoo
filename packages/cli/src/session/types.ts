import type { ComponentStatus, ListenerStatus, ObservationNotice } from '@makoojs/core';

export type RuntimeOpen = {
	runtimeId: number;
};

export type SerializedMakooError = {
	code: string;
	message: string;
	cause?: string;
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

export type SerializedDiagnostic = {
	type: 'diagnostic';
	name?: string;
	error: SerializedMakooError;
};

export type SerializedObservationNotice =
	| Exclude<ObservationNotice, { type: 'diagnostic' }>
	| SerializedDiagnostic;

export type RuntimeInjection = {
	runtimeId: number;
	injection: InjectionSnapshot;
};

export type RuntimeNotice = {
	runtimeId: number;
	notice: SerializedObservationNotice;
};

export type RuntimeSnapshot = {
	clientId: number;
	runtimeId: number;
	injections: InjectionSnapshot[];
	diagnostics: SerializedDiagnostic[];
};
