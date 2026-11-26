import type { MakooListenerDeclaration, MakooListenerInput } from './types';

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
