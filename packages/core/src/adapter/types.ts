import type { ComponentControl } from '../component/types';

export interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
	component: TComponent;
	control: ComponentControl;
	props: TProps | undefined;
	container: HTMLElement;
}

export interface ComponentAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
	readonly name: string;
	mount(params: AdapterMountParams<TComponent, TProps>): THandle;
	unmount(handle: THandle): void;
}
