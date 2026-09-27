import type { MakooError } from '../error/MakooError';
import type { ListenerSnapshot, MakooListenerDeclaration } from '../listener/types';
import type { StateView } from '../state/types';

export interface MakooComponentInput<TComponent = unknown, TProps = unknown> {
	name: string;
	injectAt: string;
	adapter: string;
	component: TComponent;
	props?: TProps;
	/** DOM search budget in milliseconds. Defaults to 15000. */
	timeout?: number;
	/** Recover when the mount target or component container becomes invalid. */
	reinject?: boolean;
	/** Named host-page listeners owned by this component. */
	listeners?: readonly Omit<MakooListenerDeclaration, 'reinject'>[];
}

export type MakooComponentDeclaration<TComponent = unknown, TProps = unknown> = Readonly<
	MakooComponentInput<TComponent, TProps> & { kind: 'component' }
>;

export type ComponentStatus = 'idle' | 'waiting' | 'mounted' | 'failed';

export interface ComponentSnapshot {
	readonly status: ComponentStatus;
}

export interface ComponentControl {
	readonly name: string;
	readonly state: StateView<ComponentSnapshot>;
	readonly lastError: MakooError | undefined;
	listenerState(listenerName: string): StateView<ListenerSnapshot>;
	start(): void;
	stop(): Promise<void>;
	remove(): Promise<void>;
}
