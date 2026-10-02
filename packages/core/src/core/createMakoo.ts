import { createAdapterRegistry } from '../adapter/registry';
import type { MountAdapter } from '../adapter/types';
import { createComponent } from '../component/component';
import { validateComponent } from '../component/declaration';
import type { MakooComponentDeclaration } from '../component/types';
import { createDOMObserver, type DOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { validateListener } from '../listener/declaration';
import { createListener } from '../listener/listener';
import type { MakooListenerDeclaration } from '../listener/types';
import type { Injection, MakooInjectionDeclaration, MakooRuntime } from './types';

type MakooInstance = {
	readonly injections: Map<string, Injection>;
	readonly adapters: ReturnType<typeof createAdapterRegistry>;
	readonly dom: DOMObserver;
};

type PreparedDeclaration =
	| { kind: 'listener'; config: MakooListenerDeclaration }
	| { kind: 'component'; config: MakooComponentDeclaration; adapter: MountAdapter };

export function createMakoo(): MakooRuntime {
	const makooInstance: MakooInstance = {
		injections: new Map(),
		adapters: createAdapterRegistry(),
		dom: createDOMObserver()
	};
	return {
		useAdapter: (adapter) => makooInstance.adapters.use(adapter),
		apply: (declarations) => applyDeclarations(makooInstance, declarations),
		command: (name) => getInjection(makooInstance.injections, name).command,
		status: (name) => getInjection(makooInstance.injections, name).status
	};
}

function applyDeclarations(
	makooInstance: MakooInstance,
	declarations: readonly MakooInjectionDeclaration[]
): void {
	const { injections, adapters, dom } = makooInstance;
	const preparedDeclarations = prepareDeclarations(declarations, injections, adapters);
	const newInjections = preparedDeclarations.map((declaration) =>
		registerInjection(injections, dom, declaration)
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
		throw new MakooError(
			'Expected a non-empty array of declarations',
			undefined,
			ErrorCode.INVALID_DECLARATION
		);
	}
	const injectionConfigs = declarations.map(validateInjection);
	const injectionNames = new Set(injections.keys());
	for (const config of injectionConfigs) {
		const name = config.name;
		if (injectionNames.has(name)) {
			throw new MakooError(
				`Injection name "${name}" is already occupied`,
				[{ path: 'name', message: name }],
				ErrorCode.INJECTION_NAME_CONFLICT
			);
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
	declaration: PreparedDeclaration
): Injection {
	const injection: Injection =
		declaration.kind === 'listener'
			? createListener(declaration.config, dom, () =>
					unregisterInjection(injections, injection)
				)
			: createComponent(declaration.config, declaration.adapter, dom, () =>
					unregisterInjection(injections, injection)
				);
	injections.set(declaration.config.name, injection);
	return injection;
}

function unregisterInjection(injections: Map<string, Injection>, injection: Injection): void {
	// A completed removal must never unregister a replacement with the same name.
	const name = injection.command.name;
	if (injections.get(name) === injection) injections.delete(name);
}

function getInjection(injections: ReadonlyMap<string, Injection>, name: string): Injection {
	const injection = injections.get(name);
	if (!injection) {
		throw new MakooError(
			`Unknown injection "${name}"`,
			undefined,
			ErrorCode.INJECTION_NOT_FOUND
		);
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
	throw new MakooError(
		'Invalid declaration',
		[{ path: 'kind', message: 'Expected listener or component' }],
		ErrorCode.INVALID_DECLARATION
	);
}
