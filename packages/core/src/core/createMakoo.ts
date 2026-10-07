import { createAdapterRegistry } from '../adapter/registry';
import type { MountAdapter } from '../adapter/types';
import { createComponent } from '../component/component';
import { validateComponent } from '../component/declaration';
import type { MakooComponentDeclaration } from '../component/types';
import { createDOMObserver, type DOMObserver } from '../dom/observer';
import { MakooErrorCode } from '../error/ErrorCode';
import { MakooAggregateError, MakooError } from '../error/MakooError';
import { validateListener } from '../listener/declaration';
import { createListener } from '../listener/listener';
import type { MakooListenerDeclaration } from '../listener/types';
import type { Injection, MakooInjectionDeclaration, MakooRuntime } from './types';

type MakooInstance = {
	readonly injections: Map<string, Injection>;
	readonly adapters: ReturnType<typeof createAdapterRegistry>;
	readonly dom: DOMObserver;
	disposed: boolean;
	disposal: Promise<void> | undefined;
};

type PreparedDeclaration =
	| { kind: 'listener'; config: MakooListenerDeclaration }
	| { kind: 'component'; config: MakooComponentDeclaration; adapter: MountAdapter };

export function createMakoo(): MakooRuntime {
	const makooInstance: MakooInstance = {
		injections: new Map(),
		adapters: createAdapterRegistry(),
		dom: createDOMObserver(),
		disposed: false,
		disposal: undefined
	};
	return {
		useAdapter: (adapter) => {
			assertOpen(makooInstance);
			makooInstance.adapters.use(adapter);
		},
		apply: (declarations) => {
			assertOpen(makooInstance);
			applyDeclarations(makooInstance, declarations);
		},
		command: (name) => getInjection(makooInstance.injections, name).command,
		status: (name) => getInjection(makooInstance.injections, name).status,
		dispose: () => disposeInstance(makooInstance)
	};
}

function applyDeclarations(
	makooInstance: MakooInstance,
	declarations: readonly MakooInjectionDeclaration[]
): void {
	const { injections, adapters, dom } = makooInstance;
	const preparedDeclarations = prepareDeclarations(declarations, injections, adapters);
	const newInjections = preparedDeclarations.map((declaration) =>
		registerInjection(injections, dom, declaration, () => makooInstance.disposed)
	);
	for (const injection of newInjections) {
		// An earlier mount may have removed or replaced a later injection in this batch.
		if (injections.get(injection.command.name) === injection) injection.command.start();
	}
}

function prepareDeclarations(
	declarations: readonly MakooInjectionDeclaration[],
	injections: ReadonlyMap<string, Injection>,
	adapters: MakooInstance['adapters']
): PreparedDeclaration[] {
	if (!Array.isArray(declarations) || declarations.length === 0) {
		throw new MakooError('Expected a non-empty array of declarations', {
			code: MakooErrorCode.DECLARATION_INVALID
		});
	}
	const injectionConfigs = declarations.map(validateInjection);
	const injectionNames = new Set(injections.keys());
	for (const config of injectionConfigs) {
		const name = config.name;
		if (injectionNames.has(name)) {
			throw new MakooError(`Injection name "${name}" is already occupied`, {
				code: MakooErrorCode.INJECTION_NAME_CONFLICT
			});
		}
		injectionNames.add(name);
	}
	return injectionConfigs.map((config) =>
		config.kind === 'listener'
			? { kind: 'listener', config }
			: { kind: 'component', config, adapter: adapters.require(config.adapter) }
	);
}

function registerInjection(
	injections: Map<string, Injection>,
	dom: DOMObserver,
	declaration: PreparedDeclaration,
	isDisposed: () => boolean
): Injection {
	const injection: Injection =
		declaration.kind === 'listener'
			? createListener(
					declaration.config,
					dom,
					() => unregisterInjection(injections, injection),
					isDisposed
				)
			: createComponent(
					declaration.config,
					declaration.adapter,
					dom,
					() => unregisterInjection(injections, injection),
					isDisposed,
					(name) => standaloneListener(injections, name)
				);
	injections.set(declaration.config.name, injection);
	return injection;
}

function unregisterInjection(injections: Map<string, Injection>, injection: Injection): void {
	// A completed removal must never unregister a replacement with the same name.
	const name = injection.command.name;
	if (injections.get(name) === injection) injections.delete(name);
}

function assertOpen(makooInstance: MakooInstance): void {
	if (!makooInstance.disposed) return;
	throw new MakooError('Core instance is disposed', { code: MakooErrorCode.INSTANCE_DISPOSED });
}

function disposeInstance(makooInstance: MakooInstance): Promise<void> {
	if (makooInstance.disposal) return makooInstance.disposal;
	makooInstance.disposed = true;
	let resolveDisposal!: () => void;
	let rejectDisposal!: (error: MakooError) => void;
	const disposal = new Promise<void>((resolve, reject) => {
		resolveDisposal = resolve;
		rejectDisposal = reject;
	});
	makooInstance.disposal = disposal;
	const removals = [...makooInstance.injections.values()].map((injection) =>
		injection.command.remove().then(
			() => undefined,
			(error: unknown) => error
		)
	);
	void Promise.all(removals).then((results) => {
		const cleanupErrors = results.filter((result) => result !== undefined);
		if (cleanupErrors.length === 0) {
			resolveDisposal();
			return;
		}
		rejectDisposal(
			new MakooAggregateError(cleanupErrors, 'Failed to dispose core', {
				code: MakooErrorCode.INSTANCE_CLEANUP_FAILED
			})
		);
	});
	return disposal;
}

function standaloneListener(injections: ReadonlyMap<string, Injection>, name: string) {
	const injection = getInjection(injections, name);
	if (injection.kind !== 'listener') {
		throw new MakooError(`Unknown injection "${name}"`, {
			code: MakooErrorCode.INJECTION_NOT_FOUND
		});
	}
	return { command: injection.command, status: injection.status };
}

function getInjection(injections: ReadonlyMap<string, Injection>, name: string): Injection {
	const injection = injections.get(name);
	if (!injection) {
		throw new MakooError(`Unknown injection "${name}"`, {
			code: MakooErrorCode.INJECTION_NOT_FOUND
		});
	}
	return injection;
}

function validateInjection(input: unknown): MakooInjectionDeclaration {
	if (typeof input === 'object' && input !== null && 'kind' in input) {
		switch (input.kind) {
			case 'listener':
				return validateListener(input);
			case 'component':
				return validateComponent(input);
		}
	}
	throw new MakooError('Invalid declaration\nkind: Expected listener or component', {
		code: MakooErrorCode.DECLARATION_INVALID
	});
}
