import type { InjectionControl } from '../injection/types';

export interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
	component: TComponent;
	props: TProps | undefined;
	container: HTMLElement;
	injection: InjectionControl;
}

export interface ComponentAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
	readonly name: string;
	mount(params: AdapterMountParams<TComponent, TProps>): THandle;
	unmount(handle: THandle): void;
}
