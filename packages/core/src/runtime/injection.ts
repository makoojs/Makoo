import { coreErrors } from '../error/coreErrors';
import type { MakooError } from '../error/MakooError';
import type { DOMObserver } from './observer';
import { createScope, type Scope, type ScopeOutcome } from './scope';

/** Facts a kind exposes to the shell for status derivation (and, later, public reads). */
export type InjectionExpose = {
	// Status facts
	live?(): boolean;

	// Public reads
	attachedListeners?(): Readonly<Record<string, unknown>>;
	children?(): readonly unknown[];
};

/**
 * What a new injection type provides: its name, the active word used while running, and
 * a setup that registers lifecycle work on the given scope. The shell owns commands,
 * status derivation and notifications — kinds never write status themselves.
 */
export type InjectionKind<D = unknown> = {
	// Identity
	readonly active: 'mounted' | 'bound' | 'collecting';
	readonly kind: string;

	// Lifecycle
	prepare?(input: unknown, context: PrepareContext): D;
	setup(scope: Scope, declaration: D, context: SetupContext): void;
};

export type InjectionStatus = 'bound' | 'collecting' | 'failed' | 'idle' | 'mounted' | 'waiting';

export type InternalShell = {
	// Identity
	readonly kind: string;
	readonly name: string;

	// Commands
	remove(): void;
	start(): void;
	stop(): void;

	// State
	readonly lastError: MakooError | undefined;
	readonly removed: boolean;
	readonly status: InjectionStatus;

	// Notifications
	subscribe(fn: () => void): () => void;

	// Flush (called by the operation context)
	/** Emits a merged notification if the snapshot changed since the last delivery. */
	deliver(): void;
	/** Executes a deferred `start()` during flush; the deferred start may have been cancelled. */
	flushStart(): void;
};

export type LockView = {
	isLocked(element: Element): boolean;
	lock(element: Element): void;
};

export type PrepareContext = {
	adapter(name: string): unknown;
};

/** The per-kind view over instance machinery, bound to one injection at setup time. */
export type SetupContext = {
	// Reporting
	changed(): void;
	diagnostic(error: MakooError, child?: string): void;
	expose(patch: InjectionExpose): void;

	// Residue locks
	isLocked(element: Element): boolean;
	lock(element: Element): void;

	// Instance machinery
	readonly observer: DOMObserver;
	operation<T>(run: () => T): T;
};

/** The instance-level machinery the shell delegates to (built per Core Instance). */
export type ShellHost = {
	// Operations and flush bookkeeping (provided by `createOperationContext`)
	/** Queues a function for flush time — it runs inside its own operation (deferred starts). */
	defer(fn: () => void): void;
	/** Marks a shell as possibly changed; recomputed once at flush via `deliver()`. */
	dirty(shell: InternalShell): void;
	operation<T>(run: () => T): T;
	/** Queues a removed shell for registry removal at flush (`injection-removed`). */
	removed(shell: InternalShell): void;

	// Instance services
	/** Throws `MAKOO_INSTANCE_DISPOSED` when the instance is closed; guards every launch (start and deferred start). */
	assertOpen(): void;
	diagnostic(error: MakooError, name?: string, child?: string): void;
	locks(key: string | readonly string[]): LockView;
	readonly observer: DOMObserver;
};

export function createInjectionShell<D>(
	declaration: D,
	injectionkind: InjectionKind<D>,
	name: string,
	host: ShellHost
): InternalShell {
	let hasDeferredStart = false;
	const kindFacts: InjectionExpose = {};
	let lastDelivered: { status: InjectionStatus; lastError: MakooError | undefined } = {
		status: 'idle',
		lastError: undefined
	};
	let lastError: MakooError | undefined;
	let removed = false;
	let rootScope: Scope | undefined;
	const subscribers = new Set<() => void>();

	const hasScopeErrors = (outcome: ScopeOutcome | undefined) =>
		outcome !== undefined && (outcome.error !== undefined || outcome.cleanupErrors.length > 0);
	// Per-injection busy flag: only this injection's scope tree running setup or teardown counts; calls across injections are never deferred
	const isTransitioning = () => rootScope?.isTransitioning ?? false;

	// auto State derivation
	const deriveStatus = (): InjectionStatus => {
		if (rootScope && !rootScope.isEnded) {
			if (injectionkind.active === 'collecting') return 'collecting';
			return kindFacts.live?.() ? injectionkind.active : 'waiting';
		}
		return hasScopeErrors(rootScope?.outcome) ? 'failed' : 'idle';
	};

	const launch = () => {
		// this round clear the lastError
		lastError = undefined;
		// create root scope
		rootScope = createScope({
			setup: (s) => {
				// Assign the root scope before running setup so stop()/remove() called inside setup can reach it
				rootScope = s;
				injectionkind.setup(s, declaration, setupCxt);
			},
			ended: (outcome) => {
				if (hasScopeErrors(outcome)) {
					// The execution failure that triggered teardown comes first, cleanup errors follow
					lastError = outcome.cleanupErrors.length
						? coreErrors.createRecorded(
								'MAKOO_INJECTION_CLEANUP_FAILED',
								{ name },
								{
									errors: [outcome.error, ...outcome.cleanupErrors].filter(
										(e) => e !== undefined
									)
								}
							)
						: (outcome.error as MakooError);
					console.error(lastError);
				}
				// The notification shell status has changed; awaiting re-derivation of the status later.
				host.dirty(shell);
			},
			// Setup stopped itself and then threw: the outcome stays "stopped", the error only goes to console (diagnostic is left to ticket 09)
			uncaughtSetupError: (cause) => console.error(cause)
		});
		host.dirty(shell);
	};
	// get self lock view
	const residueLocks = host.locks(name);

	const setupCxt: SetupContext = {
		changed: () => host.dirty(shell),
		diagnostic: (error, child) => host.diagnostic(error, name, child),
		expose: (patch) => Object.assign(kindFacts, patch),

		isLocked: residueLocks.isLocked,
		lock: residueLocks.lock,

		observer: host.observer,
		operation: host.operation
	};

	const shell: InternalShell = {
		kind: injectionkind.kind,
		name,

		remove() {
			host.operation(() => {
				if (removed) return;
				removed = true;
				hasDeferredStart = false;
				if (rootScope?.isEnded) rootScope = undefined;
				else rootScope?.stop();
				host.removed(shell);
			});
		},
		start() {
			if (removed) throw coreErrors.createThrowable('MAKOO_INJECTION_REMOVED', { name });
			if (isTransitioning()) {
				// This injection is mid setup/teardown: only set the flag, the start runs at flush time
				if (!hasDeferredStart) {
					hasDeferredStart = true;
					host.defer(() => shell.flushStart());
				}
				return;
			}
			host.operation(() => {
				host.assertOpen();
				if (rootScope && !rootScope.isEnded) return;
				launch();
			});
		},
		stop() {
			host.operation(() => {
				hasDeferredStart = false;
				if (rootScope?.isEnded) {
					// Consume the settled outcome: failed → idle, lastError is kept
					rootScope = undefined;
					host.dirty(shell);
					return;
				}
				rootScope?.stop();
			});
		},

		get lastError() {
			return lastError;
		},
		get removed() {
			return removed;
		},
		get status() {
			return deriveStatus();
		},

		subscribe(fn) {
			subscribers.add(fn);
			return () => {
				subscribers.delete(fn);
			};
		},

		deliver() {
			const snapshot = { status: deriveStatus(), lastError };
			if (
				lastDelivered.status === snapshot.status &&
				lastDelivered.lastError === snapshot.lastError
			)
				return;
			lastDelivered = snapshot;
			// Notification to all subscribers
			for (const fn of [...subscribers]) {
				try {
					fn();
				} catch (cause) {
					const error = coreErrors.create(
						'MAKOO_STATE_SUBSCRIBER_FAILED',
						{ owner: `"${name}"` },
						{ cause }
					);
					console.error(error);
					host.diagnostic(error, name);
				}
			}
		},
		flushStart() {
			if (!hasDeferredStart) return;
			hasDeferredStart = false;
			// A deferred start is dropped when the run ended with errors: status stays failed until start() is called again
			if (removed || (rootScope && !rootScope.isEnded) || hasScopeErrors(rootScope?.outcome))
				return;
			host.assertOpen();
			launch();
		}
	};
	return shell;
}

/**
 * The instance operation machinery: every command/mutation/timer enters through
 * `operation`, and only the outermost one flushes — deferred starts first, then
 * removals, then merged notifications in registration order.
 */
export function createOperationContext(registry: {
	values(): Iterable<InternalShell>;
	delete(shell: InternalShell): void;
}): Pick<ShellHost, 'defer' | 'dirty' | 'operation' | 'removed'> {
	// Three pending queues: filled during operations, drained when the outermost operation ends, in order ① starts → ② removals → ③ notifications
	const deferredTasks: (() => void)[] = [];
	const dirtyShells = new Set<InternalShell>();
	let isFlushing = false;
	let operationDepth = 0;
	const removedShells = new Set<InternalShell>();

	const context = {
		defer(fn: () => void) {
			// Pending work: run one by one in flush phase ①, each inside its own operation
			deferredTasks.push(fn);
		},
		dirty(shell: InternalShell) {
			// This shell may have changed: re-derived and notified in flush phase ③; flushes right away when already at depth 0
			dirtyShells.add(shell);
			flush();
		},
		operation<T>(run: () => T): T {
			operationDepth++;
			try {
				return run();
			} finally {
				operationDepth--;
				flush();
			}
		},
		removed(shell: InternalShell) {
			// This shell was removed: deleted from the registry in flush phase ②, emitting injection-removed
			removedShells.add(shell);
		}
	};

	function flush() {
		if (operationDepth > 0 || isFlushing) return;
		isFlushing = true;
		try {
			// Flush runs at depth 0: commands issued from subscriber callbacks are new outermost operations (isFlushing blocks nested flushes)
			while (deferredTasks.length || removedShells.size || dirtyShells.size) {
				while (deferredTasks.length) context.operation(deferredTasks.shift() as () => void);
				for (const shell of removedShells) {
					removedShells.delete(shell);
					registry.delete(shell);
				}
				for (const shell of registry.values()) {
					if (dirtyShells.delete(shell)) shell.deliver();
				}
				// Removed shells are no longer in the registry but still deliver a final notification to their subscribers
				for (const shell of dirtyShells) shell.deliver();
				dirtyShells.clear();
			}
		} finally {
			isFlushing = false;
		}
	}

	return context;
}
