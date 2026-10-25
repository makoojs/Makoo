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
import type {
	ListenerCommand,
	ListenerInjection,
	ListenerStatusHandle,
	MakooListenerDeclaration
} from '../listener/types';

/** A declaration accepted by {@link MakooRuntime.apply}, created with `listen()`, `inject()`, or `injectEach()`. */
export type MakooInjectionDeclaration =
	| MakooListenerDeclaration
	| MakooComponentDeclaration
	| MakooComponentEachDeclaration;

export type Injection = ComponentInjection | ComponentEachInjection | ListenerInjection;

/** The command of a top-level injection; narrow by how the injection was declared. */
export type InjectionCommand = ComponentCommand | ListenerCommand;

/** The status handle of a top-level injection; narrow by how the injection was declared. */
export type InjectionStatusHandle =
	| ComponentStatusHandle
	| ComponentEachStatusHandle
	| ListenerStatusHandle;

/**
 * An instance-level notice, delivered after the fact it reports has been committed.
 *
 * - `injection-removed`: a top-level injection finished cleanup and left the instance.
 * - `instance-disposed`: {@link MakooRuntime.dispose} finished tearing down every injection.
 * - `diagnostic`: a callback error that does not change any status, such as a throwing
 *   status subscriber; `name` is omitted when no injection owns the failure.
 */
export type ObservationNotice =
	| { type: 'injection-removed'; name: string }
	| { type: 'instance-disposed' }
	| { type: 'diagnostic'; name?: string; error: MakooError };

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
	 * The batch is checked as a whole first: if any entry is not a declaration, any name is taken,
	 * an attached listener sets `reinject`, or any component names an unregistered adapter, nothing
	 * in the batch is registered.
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
	 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no component or Each Injection has that name.
	 */
	injection(name: string): ComponentInjection | ComponentEachInjection;
	/**
	 * Returns the standalone listener currently registered under `name`.
	 *
	 * Repeated calls for the same registration return the same object. After that listener is
	 * removed and a new one is applied under the same name, a later call returns a new object.
	 *
	 * @throws {@link MakooError} `INJECTION_NOT_FOUND` when no standalone listener has that name.
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
	 * @returns A promise that rejects with a `MakooAggregateError`
	 * (`INSTANCE_CLEANUP_FAILED`) listing each removal that failed.
	 */
	dispose(): Promise<void>;
}
