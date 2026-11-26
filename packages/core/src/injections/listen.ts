import { coreErrors } from '../error/coreErrors';
import type { MakooError } from '../error/MakooError';
import type { ListenerStatus, MakooListenerDeclaration } from '../listener/types';
import type { InjectionKind, InternalShell, SetupContext } from '../runtime/injection';
import { type MatchHandle, match } from '../runtime/match';
import type { Scope } from '../runtime/scope';

/**
 * A standalone host listener: the flattened control, status and subscription of one
 * registration. Commands return `void`; outcomes live on `status` / `lastError`.
 */
export type ListenerInjection = {
	readonly kind: 'listener';
	readonly name: string;
	readonly status: ListenerStatus;
	readonly lastError: MakooError | undefined;
	start(): void;
	stop(): void;
	remove(): void;
	subscribe(fn: () => void): () => void;
};

/** Projects an internal listener shell into the public {@link ListenerInjection} object. */
export function createListenerInjection(shell: InternalShell): ListenerInjection {
	return Object.freeze({
		kind: 'listener',
		name: shell.name,
		get status() {
			return shell.status as ListenerStatus;
		},
		get lastError() {
			return shell.lastError;
		},
		start: () => shell.start(),
		stop: () => shell.stop(),
		remove: () => shell.remove(),
		subscribe: (fn: () => void) => shell.subscribe(fn)
	});
}

/** The `listen` injection kind: `first`-mode match + an event binding per appearance. */
export const listenerKind: InjectionKind<MakooListenerDeclaration> = {
	kind: 'listener',
	active: 'bound',
	prepare(declaration) {
		try {
			document.createDocumentFragment().querySelector(declaration.listenAt);
		} catch {
			throw coreErrors.createThrowable('MAKOO_DECLARATION_INVALID', {
				reason: `listenAt: Expected a valid CSS selector, got "${declaration.listenAt}"`
			});
		}
		return declaration;
	},
	setup(scope, declaration, context) {
		const handle = setupListener(scope, declaration, context);
		context.expose({ live: () => handle.appearances().length > 0 });
	}
};

/**
 * Seeks the first listener target and binds the event handler; also used by `inject`
 * for attached listeners. Cleanup failures residue-lock the element via `match`.
 */
export function setupListener(
	scope: Scope,
	declaration: MakooListenerDeclaration,
	context: SetupContext
): MatchHandle {
	return match(
		scope,
		declaration.listenAt,
		{
			mode: 'first',
			reinject: declaration.reinject,
			timeout: declaration.timeout,
			detachedCode: 'MAKOO_LISTENER_TARGET_DETACHED',
			name: declaration.name
		},
		context,
		(element, appearance) => bindListener(element, appearance, declaration, context)
	);
}

function bindListener(
	element: Element,
	appearance: Scope,
	declaration: MakooListenerDeclaration,
	context: SetupContext
): void {
	const handler = (event: Event) => {
		const report = (cause: unknown) => {
			const error = coreErrors.create(
				'MAKOO_LISTENER_CALLBACK_FAILED',
				{ name: declaration.name },
				{ cause }
			);
			console.error(error);
			context.diagnostic(error);
		};
		try {
			const result = declaration.callback.call(element, event);
			if (result !== undefined) void Promise.resolve(result).catch(report);
		} catch (cause) {
			report(cause);
		}
	};
	try {
		element.addEventListener(declaration.type, handler, { capture: declaration.capture });
	} catch (cause) {
		throw coreErrors.createRecorded(
			'MAKOO_LISTENER_BIND_FAILED',
			{ name: declaration.name },
			{ cause }
		);
	}
	appearance.onCleanup(() => {
		try {
			element.removeEventListener(declaration.type, handler, {
				capture: declaration.capture
			});
		} catch (cause) {
			throw coreErrors.createRecorded(
				'MAKOO_LISTENER_UNBIND_FAILED',
				{ name: declaration.name },
				{ cause }
			);
		}
	});
}
