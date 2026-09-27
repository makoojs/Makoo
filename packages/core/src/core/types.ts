import type { ComponentAdapter } from '../adapter/types';
import type { ComponentControl, MakooComponentDeclaration } from '../component/types';
import type { ListenerControl, MakooListenerDeclaration } from '../listener/types';

export type MakooInjectionDeclaration = MakooListenerDeclaration | MakooComponentDeclaration;

export type InjectionControl = ComponentControl | ListenerControl;

export interface MakooRuntime {
	useAdapter(adapter: ComponentAdapter): void;
	apply(declarations: readonly MakooInjectionDeclaration[]): void;
	get(name: string): InjectionControl;
}
