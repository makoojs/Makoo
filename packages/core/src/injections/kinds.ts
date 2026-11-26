import type { InjectionKind } from '../runtime/injection';
import { listenerKind } from './listen';

/**
 * Declaration `kind` → injection definition on the new pipeline. Component kinds still
 * route to the legacy pipeline until they are migrated.
 */
export const kinds: Record<string, InjectionKind> = {
	listener: listenerKind
};
