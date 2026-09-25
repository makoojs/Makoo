import type { MakooError } from '../error/MakooError';
import type { StateView } from '../state/types';

export interface MakooInjectionInput<TComponent = unknown, TProps = unknown> {
	name: string;
	injectAt: string;
	adapter: string;
	component: TComponent;
	props?: TProps;
	/** DOM search budget in milliseconds. Defaults to 15000. */
	timeout?: number;
}

export type MakooInjectionDeclaration<TComponent = unknown, TProps = unknown> = Readonly<
	MakooInjectionInput<TComponent, TProps> & { kind: 'injection' }
>;

export type InjectionStatus = 'idle' | 'waiting' | 'mounted' | 'failed';

export interface InjectionSnapshot {
	readonly status: InjectionStatus;
}

export interface InjectionControl {
	readonly name: string;
	readonly state: StateView<InjectionSnapshot>;
	readonly lastError: MakooError | undefined;
	start(): void;
	stop(): Promise<void>;
	remove(): Promise<void>;
}
