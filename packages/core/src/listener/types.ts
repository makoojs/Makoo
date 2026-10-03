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

export interface ListenerCommand {
	readonly name: string;
	start(): void;
	stop(): Promise<void>;
	remove(): Promise<void>;
}

export interface ListenerStatusHandle extends StateView<ListenerStatus> {
	readonly lastError: MakooError | undefined;
}

export type ListenerInjection = {
	readonly kind: 'listener';
	readonly command: ListenerCommand;
	readonly status: ListenerStatusHandle;
};
