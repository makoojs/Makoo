import type { MakooListenerDeclaration, MakooListenerInput } from './types';

export function validateListener(input: unknown): MakooListenerDeclaration {
	const value = input as MakooListenerInput & { kind: 'listener' };
	return Object.freeze({
		kind: 'listener',
		name: value.name,
		listenAt: value.listenAt,
		type: value.type,
		callback: value.callback,
		...(value.capture !== undefined ? { capture: value.capture } : {}),
		...(value.timeout !== undefined ? { timeout: value.timeout } : {}),
		...(value.reinject !== undefined ? { reinject: value.reinject } : {})
	});
}

/**
 * Declares a host listener. Apply it directly for a standalone listener, or put it in a
 * component's `listeners` for an attached listener. Validation happens when it is applied.
 *
 * @example
 * ```ts
 * makoo.apply([listen({ name: 'play', listenAt: 'video', type: 'play', callback: onPlay })]);
 * ```
 */
export function listen(input: MakooListenerInput): MakooListenerDeclaration {
	return { ...input, kind: 'listener' };
}
