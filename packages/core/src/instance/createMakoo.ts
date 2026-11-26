import { createAdapterRegistry } from '../adapter/registry';
import type { MountAdapter } from '../adapter/types';
import { createComponent } from '../component/component';
import { createComponentEach } from '../component/componentEach';
import { checkListeners } from '../component/declaration';
import type {
	ComponentEachInjection,
	ComponentInjection,
	MakooComponentDeclaration,
	MakooComponentEachDeclaration
} from '../component/types';
import { createDOMObserver } from '../dom/observer';
import { coreErrors } from '../error/coreErrors';
import type { MakooError } from '../error/MakooError';
import { kinds } from '../injections/kinds';
import { createListenerInjection, type ListenerInjection } from '../injections/listen';
import {
	createInjectionShell,
	createOperationContext,
	type InjectionKind,
	type InternalShell,
	type PrepareContext,
	type ShellHost
} from '../runtime/injection';
import { createDomObserver } from '../runtime/observer';
import { createResidueLocks } from './residue';
import type {
	MakooInjectionDeclaration,
	MakooRuntime,
	ObservationHandler,
	ObservationNotice
} from './types';

type LegacyInjection = ComponentInjection | ComponentEachInjection;

type RegistryEntry =
	| { readonly pipeline: 'legacy'; readonly injection: LegacyInjection }
	| {
			readonly pipeline: 'shell';
			readonly shell: InternalShell;
			readonly view: ListenerInjection;
	  };

type ResolvedDeclaration =
	| {
			readonly pipeline: 'legacy';
			readonly config: MakooComponentDeclaration | MakooComponentEachDeclaration;
			readonly adapter: MountAdapter;
			readonly name: string;
	  }
	| {
			readonly pipeline: 'shell';
			readonly kind: InjectionKind;
			readonly declaration: unknown;
			readonly name: string;
	  };

/** Creates an independent Core Instance with no adapters and no injections. */
export function createMakoo(): MakooRuntime {
	const injections = new Map<string, RegistryEntry>();
	const adapters = createAdapterRegistry();
	const dom = createDOMObserver();
	const observers = new Set<ObservationHandler>();
	let disposed = false;
	let disposal: Promise<void> | undefined;

	const emit = (notice: ObservationNotice): void => {
		for (const handler of [...observers]) {
			try {
				handler(notice);
			} catch (cause) {
				const error = coreErrors.create('MAKOO_INSTANCE_OBSERVER_FAILED', { cause });
				console.error(error);
				// Avoid recursive diagnostics.
				if (notice.type !== 'diagnostic') emit({ type: 'diagnostic', error });
			}
		}
	};

	const assertOpen = (): void => {
		if (disposed) throw coreErrors.createThrowable('MAKOO_INSTANCE_DISPOSED');
	};

	const operations = createOperationContext({
		values() {
			const shells: InternalShell[] = [];
			for (const entry of injections.values())
				if (entry.pipeline === 'shell') shells.push(entry.shell);
			return shells;
		},
		delete(shell) {
			// Unregister only this shell — a later same-name replacement must stay; the
			// removal notice still fires since the removed shell did leave the registry.
			const entry = injections.get(shell.name);
			if (entry?.pipeline === 'shell' && entry.shell === shell) injections.delete(shell.name);
			emit({ type: 'injection-removed', name: shell.name });
		}
	});

	const host: ShellHost = {
		...operations,
		assertOpen,
		diagnostic: (error, name, child) =>
			emit({
				type: 'diagnostic',
				...(name !== undefined ? { name } : {}),
				...(child !== undefined ? { child } : {}),
				error
			}),
		locks: createResidueLocks(),
		observer: createDomObserver((run) => operations.operation(run))
	};

	const prepareContext: PrepareContext = {
		adapter: (name) => adapters.get(name)
	};

	return {
		useAdapter(adapter) {
			assertOpen();
			adapters.use(adapter);
		},
		apply(declarations) {
			assertOpen();
			operations.operation(() => applyDeclarations(declarations));
		},
		injection(name) {
			assertOpen();
			return getComponentInjection(name);
		},
		listener(name) {
			assertOpen();
			return getListenerInjection(name);
		},
		observe(handler) {
			assertOpen();
			observers.add(handler);
			return () => {
				observers.delete(handler);
			};
		},
		dispose: () => disposeInstance()
	};

	function applyDeclarations(declarations: readonly MakooInjectionDeclaration[]): void {
		if (declarations.length === 0) {
			throw coreErrors.createThrowable('MAKOO_DECLARATION_INVALID', {
				reason: 'Expected a non-empty array of declarations'
			});
		}
		const resolvedDecls = declarations.map(resolveDeclaration);
		// A removed shell's name is free even before the flush unregisters it — its
		// replacement may already be applied inside the same outermost operation.
		const injectionNames = new Set<string>();
		for (const [key, entry] of injections)
			if (entry.pipeline !== 'shell' || !entry.shell.removed) injectionNames.add(key);
		for (const declEntry of resolvedDecls) {
			if (injectionNames.has(declEntry.name)) {
				throw coreErrors.createThrowable('MAKOO_INJECTION_NAME_CONFLICT', {
					name: declEntry.name
				});
			}
			injectionNames.add(declEntry.name);
		}
		for (const entry of resolvedDecls.map(registerDeclaration)) entry.start();
	}

	function resolveDeclaration(input: MakooInjectionDeclaration): ResolvedDeclaration {
		const injectionKind = kinds[input.kind];
		if (injectionKind) {
			const declaration = injectionKind.prepare(input, prepareContext);
			return { pipeline: 'shell', kind: injectionKind, declaration, name: input.name };
		}
		switch (input.kind) {
			case 'component':
				checkListeners(input);
				return {
					pipeline: 'legacy',
					config: input,
					adapter: adapters.get(input.adapter),
					name: input.name
				};
			case 'component-each':
				return {
					pipeline: 'legacy',
					config: input,
					adapter: adapters.get(input.adapter),
					name: input.name
				};
		}
		throw coreErrors.createThrowable('MAKOO_DECLARATION_INVALID', {
			reason: 'Invalid declaration\nkind: Expected listener, component, or component-each'
		});
	}

	function registerDeclaration(resolvedDecl: ResolvedDeclaration): { start(): void } {
		if (resolvedDecl.pipeline === 'shell') {
			const shell = createInjectionShell(
				resolvedDecl.declaration,
				resolvedDecl.kind,
				resolvedDecl.name,
				host
			);
			const view = createListenerInjection(shell);
			injections.set(resolvedDecl.name, { pipeline: 'shell', shell, view });
			return {
				start() {
					// An earlier start in this batch may have removed or replaced this registration.
					const entry = injections.get(resolvedDecl.name);
					if (entry?.pipeline === 'shell' && entry.shell === shell && !shell.removed)
						shell.start();
				}
			};
		}
		const injection = registerLegacyInjection(resolvedDecl);
		return {
			start() {
				const entry = injections.get(injection.command.name);
				if (entry?.pipeline === 'legacy' && entry.injection === injection)
					injection.command.start();
			}
		};
	}

	function registerLegacyInjection(
		resolvedDecl: Extract<ResolvedDeclaration, { pipeline: 'legacy' }>
	): LegacyInjection {
		const onDiagnostic = (name: string, error: MakooError) => {
			emit({ type: 'diagnostic', name, error });
		};
		const onRemoved = () => unregisterInjection(injection);
		const listener = (name: string) => getListenerInjection(name);
		const injection: LegacyInjection =
			resolvedDecl.config.kind === 'component-each'
				? createComponentEach(
						resolvedDecl.config,
						resolvedDecl.adapter,
						dom,
						onRemoved,
						() => disposed,
						listener,
						onDiagnostic
					)
				: createComponent(
						resolvedDecl.config,
						resolvedDecl.adapter,
						dom,
						onRemoved,
						() => disposed,
						listener,
						onDiagnostic
					);
		injections.set(resolvedDecl.name, { pipeline: 'legacy', injection });
		return injection;
	}

	function unregisterInjection(injection: LegacyInjection): void {
		// A completed removal must never unregister a replacement with the same name.
		const name = injection.command.name;
		const entry = injections.get(name);
		if (entry?.pipeline !== 'legacy' || entry.injection !== injection) return;
		injections.delete(name);
		emit({ type: 'injection-removed', name });
	}

	function getComponentInjection(name: string): LegacyInjection {
		const entry = injections.get(name);
		if (entry?.pipeline !== 'legacy') {
			throw coreErrors.createThrowable('MAKOO_INJECTION_NOT_FOUND', { name });
		}
		return entry.injection;
	}

	function getListenerInjection(name: string): ListenerInjection {
		const entry = injections.get(name);
		if (entry?.pipeline !== 'shell' || entry.shell.kind !== 'listener') {
			throw coreErrors.createThrowable('MAKOO_INJECTION_NOT_FOUND', { name });
		}
		return entry.view;
	}

	function disposeInstance(): Promise<void> {
		if (disposal) return disposal;
		disposed = true;
		let resolveDisposal!: () => void;
		let rejectDisposal!: (error: unknown) => void;
		const pending = new Promise<void>((resolve, reject) => {
			resolveDisposal = resolve;
			rejectDisposal = reject;
		});
		disposal = pending;
		void (async () => {
			const cleanupErrors: unknown[] = [];
			// Tear down in registration order so injection-removed notices stay deterministic.
			for (const entry of [...injections.values()]) {
				try {
					if (entry.pipeline === 'shell') {
						// lastError survives a consumed failure; only a fresh one is this removal's
						const before = entry.shell.lastError;
						entry.shell.remove();
						const after = entry.shell.lastError;
						if (after !== before && after?.code === 'MAKOO_INJECTION_CLEANUP_FAILED')
							cleanupErrors.push(after);
					} else {
						await entry.injection.command.remove();
					}
				} catch (error) {
					cleanupErrors.push(error);
				}
			}
			const aggregate = cleanupErrors.length
				? coreErrors.createRecorded('MAKOO_INSTANCE_CLEANUP_FAILED', {
						errors: cleanupErrors
					})
				: undefined;
			emit({ type: 'instance-disposed', ...(aggregate ? { error: aggregate } : {}) });
			observers.clear();
			if (aggregate) rejectDisposal(aggregate);
			else resolveDisposal();
		})();
		return pending;
	}
}
