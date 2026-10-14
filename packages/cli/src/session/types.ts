import type { ComponentStatus, ListenerStatus } from '@makoojs/core';

export type TaskKind = 'component' | 'listener' | (string & {});

export type TaskStatus = ComponentStatus | ListenerStatus | 'active' | 'pending' | (string & {});

export type SerializedMakooError = {
	name?: string;
	message: string;
	stack?: string;
	code?: string;
	summary?: string;
	issues?: Array<{ path: string; message: string }>;
	context?: Record<string, string | number | boolean | null>;
	cause?: unknown;
};

export type SessionNotice = {
	name: string;
	taskId?: string;
	injectionName?: string;
	kind?: TaskKind;
	status?: TaskStatus;
	preStatus?: TaskStatus;
	injectAt?: string;
	error?: SerializedMakooError | unknown;
	meta?: Record<string, unknown>;
	[key: string]: unknown;
};

export type RuntimeOpen = {
	runtimeId: number;
};

export type RuntimeEvent = {
	runtimeId: number;
	event: SessionNotice;
};

export type TaskSnapshot = {
	taskId: string;
	kind: TaskKind;
	status: TaskStatus;
	injectAt: string;
};

export type RuntimeSnapshot = {
	clientId: number;
	runtimeId: number;
	tasks: TaskSnapshot[];
};
