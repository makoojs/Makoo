import type { ChildInjection, ComponentInjection } from '../component/types';
import type { ListenerInjection } from '../listener/types';

/** What Core passes to {@link MountAdapter.mount} for one component execution. */
export interface AdapterMountParams<TComponent = unknown, TProps = unknown> {
	/** The `component` from the declaration, unchanged. */
	component: TComponent;
	/**
	 * The component injection being mounted; same object as `core.injection(name)` for a
	 * top-level injection, or the Child bag (without `start`/`remove`) for a mount under an
	 * Each Injection.
	 */
	injection: ComponentInjection | ChildInjection;
	/** The `props` from the declaration, unchanged. */
	props: TProps | undefined;
	/** The component container Core created inside the mount target; Core removes it after unmount. */
	container: HTMLElement;
	/**
	 * Looks up a standalone listener in the owning Core Instance.
	 *
	 * @throws `MakooError` with `INJECTION_NOT_FOUND` when no standalone listener has that name.
	 */
	listener(name: string): ListenerInjection;
}

/**
 * Integrates a frontend framework with Core's component mounting.
 *
 * @typeParam THandle - Whatever `mount` returns; Core passes it back to `unmount` untouched.
 */
export interface MountAdapter<TComponent = unknown, TProps = unknown, THandle = unknown> {
	/** The name component declarations use in their `adapter` field. */
	readonly name: string;
	/** Mounts the component into `params.container` synchronously; a throw fails the execution. */
	mount(params: AdapterMountParams<TComponent, TProps>): THandle;
	/** Unmounts what `mount` created; a throw is a cleanup failure. */
	unmount(mountHandle: THandle): void;
}
