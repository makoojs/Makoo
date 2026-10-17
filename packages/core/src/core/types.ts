import type { MountAdapter } from '../adapter/types';
import type {
	ComponentCommand,
	ComponentInjection,
	ComponentStatusHandle,
	MakooComponentDeclaration
} from '../component/types';
import type { MakooError } from '../error/MakooError';
import type {
	ListenerCommand,
	ListenerInjection,
	ListenerStatusHandle,
	MakooListenerDeclaration
} from '../listener/types';

export type MakooInjectionDeclaration = MakooListenerDeclaration | MakooComponentDeclaration;

export type Injection = ComponentInjection | ListenerInjection;

export type InjectionCommand = ComponentCommand | ListenerCommand;

export type InjectionStatusHandle = ComponentStatusHandle | ListenerStatusHandle;

export type ObservationNotice =
	| { type: 'injection-removed'; name: string }
	| { type: 'instance-disposed' }
	| { type: 'diagnostic'; name?: string; error: MakooError };

export type ObservationHandler = (notice: ObservationNotice) => void;

export interface MakooRuntime {
	useAdapter(adapter: MountAdapter): void;
	apply(declarations: readonly MakooInjectionDeclaration[]): void;
	command(name: string): InjectionCommand;
	statusHandle(name: string): InjectionStatusHandle;
	observe(handler: ObservationHandler): () => void;
	dispose(): Promise<void>;
}
