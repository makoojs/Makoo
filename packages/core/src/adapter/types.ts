import type { ComponentCommand, ComponentStatusHandle } from '../component/types';
import type { ListenerInjection } from '../listener/types';

export interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
	component: TComponent;
	command: ComponentCommand;
	status: ComponentStatusHandle;
	props: TProps | undefined;
	container: HTMLElement;
	/** Looks up a standalone listener in the owning Core Instance. */
	globalListener(name: string): Omit<ListenerInjection, 'kind'>;
}

export interface MountAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
	readonly name: string;
	mount(params: AdapterMountParams<TComponent, TProps>): THandle;
	unmount(handle: THandle): void;
}
