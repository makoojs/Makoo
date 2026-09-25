import type { MakooError } from '../error/MakooError';
import type { StateView } from '../state/types';

export interface MakooListenerInput {
	name: string;
	listenAt: string;
	type: string;
	callback: (this: Element, event: Event) => unknown;
	capture?: boolean;
	/** DOM search budget in milliseconds. Defaults to 15000. */
	timeout?: number;
	/** Recover after the bound host disconnects. Defaults to false. */
	reinject?: boolean;
}

export type MakooListenerDeclaration = Readonly<MakooListenerInput & { kind: 'listener' }>;

export type ListenerStatus = 'idle' | 'waiting' | 'bound' | 'failed';

export interface ListenerSnapshot {
	readonly status: ListenerStatus;
}

export interface ListenerControl {
	readonly name: string;
	readonly state: StateView<ListenerSnapshot>;
	readonly lastError: MakooError | undefined;
	start(): void;
	stop(): Promise<void>;
	remove(): Promise<void>;
}
