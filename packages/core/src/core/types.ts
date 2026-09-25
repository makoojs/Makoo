import type { ComponentAdapter } from '../adapter/types';
import type { MakooError } from '../error/MakooError';
import type { MakooInjectionDeclaration } from '../injection/types';
import type { MakooListenerDeclaration } from '../listener/types';
import type { StateView } from '../state/types';

export type MakooFeatureDeclaration = MakooListenerDeclaration | MakooInjectionDeclaration;

export interface FeatureControl {
	readonly name: string;
	readonly state: StateView<{ readonly status: string }>;
	readonly lastError: MakooError | undefined;
	start(): void;
	stop(): Promise<void>;
	remove(): Promise<void>;
}

export interface MakooRuntime {
	useAdapter(adapter: ComponentAdapter): void;
	apply(declarations: readonly MakooFeatureDeclaration[]): void;
	get(name: string): FeatureControl;
}
