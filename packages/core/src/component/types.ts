import type { MakooError } from '../error/MakooError';
import type { ListenerStatus, MakooListenerDeclaration } from '../listener/types';
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

export interface ComponentCommand {
	readonly name: string;
	start(): void;
	stop(): Promise<void>;
	remove(): Promise<void>;
}

/** Component status entry: own stage plus attached listener status views. */
export interface ComponentStatusHandle extends StateView<ComponentStatus> {
	readonly lastError: MakooError | undefined;
	readonly listenerNames: readonly string[];
	listener(name: string): StateView<ListenerStatus>;
}

export type ComponentInjection = {
	readonly kind: 'component';
	readonly command: ComponentCommand;
	readonly status: ComponentStatusHandle;
};
