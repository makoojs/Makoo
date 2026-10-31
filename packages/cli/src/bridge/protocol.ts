import type { ComponentEachStatus, ComponentStatus, ListenerStatus } from '@makoojs/core';

/** Transport endpoint handed to the page runtime; token travels in the ws query. */
export type DevEndpoint = {
	host: string;
	port: number;
	token: string;
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

/** One anonymous Child Injection under an Each Injection, in document order. */
export type ChildSnapshot = {
	status: ComponentStatus;
	lastError?: SerializedMakooError;
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
			kind: 'component-each';
			status: ComponentEachStatus;
			lastError?: SerializedMakooError;
			children: ChildSnapshot[];
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

/** One Core instance's complete row inside a page submission. */
export type PageRuntimeRow = {
	runtimeId: number;
	injections: InjectionSnapshot[];
	diagnostics: SerializedDiagnostic[];
};

export const SUBMIT_PAGE_RPC = 'makoo:submit-page';

declare module 'devframe' {
	interface DevframeRpcServerFunctions {
		'makoo:submit-page': (rows: PageRuntimeRow[]) => Promise<void>;
	}
}
