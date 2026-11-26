import { coreErrors } from '../error/coreErrors';
import type {
	MakooComponentDeclaration,
	MakooComponentEachDeclaration,
	MakooComponentEachInput,
	MakooComponentInput
} from './types';

/** Rejects attached listeners with duplicate names or their own `reinject`. */
export function checkListeners(declaration: MakooComponentDeclaration): void {
	const names = new Set<string>();
	declaration.listeners?.forEach((listener, index) => {
		if (names.has(listener.name)) {
			throw coreErrors.createThrowable('MAKOO_INJECTION_NAME_CONFLICT', {
				name: listener.name,
				at: `listeners[${index}]`
			});
		}
		if ('reinject' in listener && listener.reinject !== undefined) {
			throw coreErrors.createThrowable('MAKOO_DECLARATION_INVALID', {
				reason: `Attached listeners inherit the component recovery setting (listeners[${index}].reinject)`
			});
		}
		names.add(listener.name);
	});
}

/**
 * Declares a component injection. Validation happens when the declaration is applied.
 *
 * @example
 * ```ts
 * makoo.apply([inject({ name: 'panel', injectAt: '#sidebar', adapter: 'vue', component: Panel })]);
 * ```
 */
export function inject<TComponent = unknown, TProps = unknown>(
	input: MakooComponentInput<TComponent, TProps>
): MakooComponentDeclaration<TComponent, TProps> {
	return { ...input, kind: 'component' };
}

/**
 * Declares an Each Injection: one Child per matching mount target. Validation happens on apply.
 *
 * @example
 * ```ts
 * makoo.apply([injectEach({ name: 'badges', injectAt: '.badge', adapter: 'vue', component: Badge })]);
 * ```
 */
export function injectEach<TComponent = unknown, TProps = unknown>(
	input: MakooComponentEachInput<TComponent, TProps>
): MakooComponentEachDeclaration<TComponent, TProps> {
	return { ...input, kind: 'component-each' };
}
