import { createAdapterRegistry } from '../adapter/registry';
import type { ComponentAdapter } from '../adapter/types';
import { createComponent } from '../component/component';
import { validateComponent } from '../component/declaration';
import type { MakooComponentDeclaration } from '../component/types';
import { createDOMObserver, type DOMObserver } from '../dom/observer';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { validateListener } from '../listener/declaration';
import { createListener } from '../listener/listener';
import type { MakooListenerDeclaration } from '../listener/types';
import type { InjectionControl, MakooInjectionDeclaration, MakooRuntime } from './types';

type MakooInstance = {
	readonly injections: Map<string, InjectionControl>;
	readonly adapters: ReturnType<typeof createAdapterRegistry>;
	readonly dom: DOMObserver;
};

type PreparedDeclaration =
	| { kind: 'listener'; config: MakooListenerDeclaration }
	| { kind: 'component'; config: MakooComponentDeclaration; adapter: ComponentAdapter };

export function createMakoo(): MakooRuntime {
	const makooInstance: MakooInstance = {
		injections: new Map(),
		adapters: createAdapterRegistry(),
		dom: createDOMObserver()
	};
	return {
		useAdapter: (adapter) => makooInstance.adapters.use(adapter),
		apply: (declarations) => applyDeclarations(makooInstance, declarations),
		get: (name) => getInjection(makooInstance.injections, name)
	};
}

function applyDeclarations(
	makooInstance: MakooInstance,
	declarations: readonly MakooInjectionDeclaration[]
): void {
	const { injections, adapters, dom } = makooInstance;
	const preparedDeclarations = prepareDeclarations(declarations, injections, adapters);
	const registeredControls = preparedDeclarations.map((declaration) =>
		registerInjection(injections, dom, declaration)
	);
	for (const injectionControl of registeredControls) {
		// An earlier mount may have removed or replaced a later injection in this batch.
		if (injections.get(injectionControl.name) === injectionControl) injectionControl.start();
	}
}

function prepareDeclarations(
	declarations: readonly MakooInjectionDeclaration[],
	injections: ReadonlyMap<string, InjectionControl>,
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
	injections: Map<string, InjectionControl>,
	dom: DOMObserver,
	declaration: PreparedDeclaration
): InjectionControl {
	const injectionControl: InjectionControl =
		declaration.kind === 'listener'
			? createListener(declaration.config, dom, () =>
					unregisterInjection(injections, injectionControl)
				)
			: createComponent(declaration.config, declaration.adapter, dom, () =>
					unregisterInjection(injections, injectionControl)
				);
	injections.set(declaration.config.name, injectionControl);
	return injectionControl;
}

function unregisterInjection(
	injections: Map<string, InjectionControl>,
	injectionControl: InjectionControl
): void {
	// A completed removal must never unregister a replacement with the same name.
	const name = injectionControl.name;
	if (injections.get(name) === injectionControl) injections.delete(name);
}

function getInjection(
	injections: ReadonlyMap<string, InjectionControl>,
	name: string
): InjectionControl {
	const injectionControl = injections.get(name);
	if (!injectionControl) {
		throw new MakooError(
			`Unknown injection "${name}"`,
			undefined,
			ErrorCode.INJECTION_NOT_FOUND
		);
	}
	return injectionControl;
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
