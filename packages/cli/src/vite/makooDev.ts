import type { Plugin } from 'vite';

const VIRTUAL_CORE_ID = '\0virtual:makoo-dev';
const CORE_PACKAGE = '@makoojs/core';

// The method of wrapping and passing multiple methods allows each runtime to have its own entry point, avoiding event sharing.
function buildVirtualModuleSource(resolvedCoreId: string): string {
	const coreId = JSON.stringify(resolvedCoreId);

	return `
export * from ${coreId};
import {
	createMakoo as __makooCreateMakoo,
	createObserverHub as __makooCreateObserverHub,
	MakooError as __MakooError
} from ${coreId};

function __makooSerializeObserveEvent(event) {
	const { error, ...rest } = event;

	if (error === undefined) {
		return rest;
	}

	if (error instanceof __MakooError) {
		return {
			...rest,
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
				code: error.code,
				summary: error.summary,
				issues: error.issues,
				context: error.context
			}
		};
	}

	if (error instanceof Error) {
		return {
			...rest,
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack
			}
		};
	}

	return {
		...rest,
		error: {
			message: String(error)
		}
	};
}

function __makooSend(event, payload) {
	try {
		import.meta.hot?.send(event, payload);
	} catch {
		// Session transport failures must not affect the user runtime.
	}
}

function __makooCreateSessionObserver(observer, runtime) {
	const sendEvent = (event) => {
		__makooSend('makoo:runtime:event', {
			runtime,
			event: __makooSerializeObserveEvent(event)
		});
	};

	return {
		on(event, hook) {
			return observer.on(event, hook);
		},
		onTask(taskId, event, hook) {
			return observer.onTask(taskId, event, hook);
		},
		onAny(hook) {
			return observer.onAny(hook);
		},
		off(event, hook) {
			observer.off(event, hook);
		},
		offTask(taskId, event, hook) {
			observer.offTask(taskId, event, hook);
		},
		offAny(hook) {
			observer.offAny(hook);
		},
		clear() {
			observer.clear();
		},
		hasHooks(event) {
			return observer.hasHooks(event);
		},
		emit(event) {
			sendEvent(event);
			observer.emit(event);
		},
		emitOnTask(taskId, event) {
			const normalized = event.taskId === taskId ? event : { ...event, taskId };
			sendEvent(normalized);
			observer.emitOnTask(taskId, event);
		}
	};
}

let __makooNextRuntime = 1;

export function createMakoo(options = {}) {
	const runtime = __makooNextRuntime++;
	const baseObserver = options.observer ?? __makooCreateObserverHub(options.logger);
	const observer = __makooCreateSessionObserver(baseObserver, runtime);
	const makoo = __makooCreateMakoo({
		...options,
		observer
	});

	__makooSend('makoo:runtime:open', { runtime });
	return makoo;
}
`;
}

export function makooDev(): Plugin {
	let resolvedCoreId: string | null = null;

	return {
		name: 'makoo:dev',
		apply: 'serve',
		enforce: 'pre',
		async resolveId(source, importer, options) {
			if (source !== CORE_PACKAGE) {
				return null;
			}

			const resolved = await this.resolve(CORE_PACKAGE, importer, {
				...options,
				skipSelf: true
			});
			if (!resolved) {
				return null;
			}

			resolvedCoreId = resolved.id;
			return VIRTUAL_CORE_ID;
		},
		load(id) {
			if (id !== VIRTUAL_CORE_ID) {
				return null;
			}
			if (!resolvedCoreId) {
				return null;
			}
			return buildVirtualModuleSource(resolvedCoreId);
		}
	};
}
