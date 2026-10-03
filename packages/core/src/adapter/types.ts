import type { ComponentCommand, ComponentStatusHandle } from '../component/types';

export interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
	component: TComponent;
	command: ComponentCommand;
	status: ComponentStatusHandle;
	props: TProps | undefined;
	container: HTMLElement;
}

export interface MountAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
	readonly name: string;
	mount(params: AdapterMountParams<TComponent, TProps>): THandle;
	unmount(handle: THandle): void;
}
