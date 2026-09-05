import type { ObserveEvent } from '@makoojs/core';

type TaskKind = NonNullable<ObserveEvent['kind']>;
type TaskStatus = NonNullable<ObserveEvent['status']>;

export type RuntimeOpen = {
	runtimeId: number;
};

export type RuntimeEvent = {
	runtimeId: number;
	event: ObserveEvent;
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

export type RuntimeLog = {
	clientId: number;
	runtimeId: number;
	event: ObserveEvent;
};
