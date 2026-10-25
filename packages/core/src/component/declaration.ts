import { MakooErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import { validateListener } from '../listener/declaration';
import type {
	MakooComponentDeclaration,
	MakooComponentEachDeclaration,
	MakooComponentEachInput,
	MakooComponentInput
} from './types';

export function validateComponent(input: unknown): MakooComponentDeclaration {
	const value = input as MakooComponentInput & { kind: 'component' };
	const names = new Set<string>();
	const listeners = value.listeners?.map((listenerInput, index) => {
		const listener = validateListener(listenerInput);
		if (names.has(listener.name)) {
			throw new MakooError(
				`Duplicate attached listener "${listener.name}" at listeners[${index}]`,
				{
					code: MakooErrorCode.INJECTION_NAME_CONFLICT
				}
			);
		}
		if (listener.reinject !== undefined) {
			throw new MakooError(
				`Attached listeners inherit the component recovery setting (listeners[${index}].reinject)`,
				{ code: MakooErrorCode.DECLARATION_INVALID }
			);
		}
		names.add(listener.name);
		return listener;
	});
	return Object.freeze({
		kind: 'component',
		name: value.name,
		injectAt: value.injectAt,
		adapter: value.adapter,
		component: value.component,
		...(value.props !== undefined ? { props: value.props } : {}),
		...(value.timeout !== undefined ? { timeout: value.timeout } : {}),
		...(value.reinject !== undefined ? { reinject: value.reinject } : {}),
		...(listeners !== undefined ? { listeners: Object.freeze(listeners) } : {})
	});
}

export function validateComponentEach(input: unknown): MakooComponentEachDeclaration {
	const value = input as MakooComponentEachInput & { kind: 'component-each' };
	return Object.freeze({
		kind: 'component-each',
		name: value.name,
		injectAt: value.injectAt,
		adapter: value.adapter,
		component: value.component,
		...(value.props !== undefined ? { props: value.props } : {})
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
