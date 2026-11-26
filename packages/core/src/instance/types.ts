import type { MountAdapter } from '../adapter/types';
import type {
	ComponentCommand,
	ComponentEachInjection,
	ComponentEachStatusHandle,
	ComponentInjection,
	ComponentStatusHandle,
	MakooComponentDeclaration,
	MakooComponentEachDeclaration
} from '../component/types';
import type { MakooError } from '../error/MakooError';
import type { ListenerInjection } from '../injections/listen';
import type { MakooListenerDeclaration } from '../listener/types';

/** A declaration accepted by {@link MakooRuntime.apply}, created with `listen()`, `inject()`, or `injectEach()`. */
export type MakooInjectionDeclaration =
	| MakooListenerDeclaration
	| MakooComponentDeclaration
	| MakooComponentEachDeclaration;

export type Injection = ComponentInjection | ComponentEachInjection | ListenerInjection;

/** The command of a top-level component or Each Injection; narrow by how the injection was declared. */
export type InjectionCommand = ComponentCommand;

/** The status handle of a top-level component or Each Injection; narrow by how the injection was declared. */
export type InjectionStatusHandle = ComponentStatusHandle | ComponentEachStatusHandle;

/**
 * An instance-level notice, delivered after the fact it reports has been committed.
 *
 * - `injection-removed`: a top-level injection finished cleanup and left the instance.
 * - `instance-disposed`: {@link MakooRuntime.dispose} finished tearing down every injection;
 *   `error` is the aggregate cleanup failure when one or more removals failed.
 * - `diagnostic`: a callback error that does not change any status, such as a throwing
 *   status subscriber or event handler; `name` is the owning injection (omitted when there
 *   is none), `child` names a Child Injection the failure belongs to.
 */
export type ObservationNotice =
	| { type: 'injection-removed'; name: string }
	| { type: 'instance-disposed'; error?: MakooError }
	| { type: 'diagnostic'; name?: string; child?: string; error: MakooError };

/** Receives instance notices; a throwing handler is reported and does not stop delivery. */
export type ObservationHandler = (notice: ObservationNotice) => void;

/** A Core Instance: owns a set of injections and the adapters that mount their components. */
export interface MakooRuntime {
	/**
	 * Registers a component adapter under its `name`.
	 *
	 * @throws {@link MakooError} `ADAPTER_NAME_CONFLICT` for a name already registered here,
	 * or `INSTANCE_DISPOSED` after {@link MakooRuntime.dispose}.
	 */
	useAdapter(adapter: MountAdapter): void;
	/**
	 * Registers a batch of injections and starts each of them.
	 *
	 * The batch is checked as a whole first: if any name is taken, an attached listener sets
	 * `reinject`, a `listenAt` selector is invalid, or any component names an unregistered
	 * adapter, nothing in the batch is registered.
	 *
	 * @throws {@link MakooError} `DECLARATION_INVALID`, `INJECTION_NAME_CONFLICT`,
	 * `ADAPTER_NOT_FOUND`, or `INSTANCE_DISPOSED`.
	 */
	apply(declarations: readonly MakooInjectionDeclaration[]): void;
	/**
	 * Returns the component or Each Injection currently registered under `name`.
	 *
	 * Repeated calls for the same registration return the same object. After that injection is
	 * removed and a new one is applied under the same name, a later call returns a new object.
	 * Narrow with `kind` (`component` vs `component-each`) for `children`.
	 *
	 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no component or Each Injection has that name,
	 * or `INSTANCE_DISPOSED` after {@link MakooRuntime.dispose}.
	 */
	injection(name: string): ComponentInjection | ComponentEachInjection;
	/**
	 * Returns the standalone listener currently registered under `name`.
	 *
	 * Repeated calls for the same registration return the same object. After that listener is
	 * removed and a new one is applied under the same name, a later call returns a new object.
	 *
	 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no standalone listener has that name, or
	 * `INSTANCE_DISPOSED` after {@link MakooRuntime.dispose}.
	 */
	listener(name: string): ListenerInjection;
	/**
	 * Subscribes to instance notices.
	 *
	 * @returns A function that ends the subscription.
	 * @throws {@link MakooError} `INSTANCE_DISPOSED` after {@link MakooRuntime.dispose}.
	 */
	observe(handler: ObservationHandler): () => void;
	/**
	 * Closes the instance and removes every injection in registration order.
	 * Repeated calls return the same promise.
	 *
	 * @returns A promise that rejects with a `MakooError`
	 * (`INSTANCE_CLEANUP_FAILED`) whose `errors` list each removal that failed.
	 */
	dispose(): Promise<void>;
}
