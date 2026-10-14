import type { InlineConfig, Plugin } from 'vite';
import { DevSession } from '../session/DevSession';
import type { RuntimeEvent, RuntimeOpen } from '../session/types';

const VIRTUAL_CORE_ID = '\0virtual:makoo-dev';
const CORE_PACKAGE = '@makoojs/core';

export const bindDevSession = Symbol('makooDev.bindSession');

export type InlineConfigWithSession = InlineConfig & {
	[bindDevSession]?: (session: DevSession) => void;
};

// Explicit delegation keeps event forwarding isolated for each runtime without replacing the user observer.
function buildVirtualModuleSource(resolvedCoreId: string): string {
	const coreId = JSON.stringify(resolvedCoreId);

	return `
export * from ${coreId};
import {
	createMakoo as __makooCreateMakoo,
	MakooError as __MakooError
} from ${coreId};

function __makooSerializeError(error) {
	if (error === undefined || error === null) {
		return undefined;
	}

	if (error instanceof __MakooError) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			code: error.code,
			summary: error.message,
			cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : error.cause
		};
	}

	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack
		};
	}

	return {
		message: String(error)
	};
}

function __makooSend(event, payload) {
	try {
		import.meta.hot?.send(event, payload);
	} catch {
		// Session transport failures must not affect the user runtime.
	}
}

let __makooNextRuntimeId = 1;

export function createMakoo(...args) {
	const makoo = __makooCreateMakoo(...args);
	const runtimeId = __makooNextRuntimeId++;

	__makooSend('makoo:runtime:open', { runtimeId });

	makoo.observe((notice) => {
		if (notice.type === 'injection-removed') {
			__makooSend('makoo:runtime:event', {
				runtimeId,
				event: {
					name: 'injection-removed',
					taskId: notice.name
				}
			});
		} else if (notice.type === 'instance-disposed') {
			__makooSend('makoo:runtime:event', {
				runtimeId,
				event: {
					name: 'instance-disposed'
				}
			});
		} else if (notice.type === 'diagnostic') {
			__makooSend('makoo:runtime:event', {
				runtimeId,
				event: {
					name: 'diagnostic',
					taskId: notice.name,
					error: __makooSerializeError(notice.error)
				}
			});
		}
	});

	const originalApply = makoo.apply.bind(makoo);
	makoo.apply = function(declarations) {
		originalApply(declarations);
		if (Array.isArray(declarations)) {
			for (const decl of declarations) {
				if (!decl || !decl.name) continue;
				const taskId = decl.name;
				const kind = decl.kind;
				const injectAt = decl.kind === 'component' ? decl.injectAt : decl.listenAt;
				try {
					const handle = makoo.statusHandle(taskId);
					const status = handle.getSnapshot();
					const regEvent = {
						name: 'register:success',
						taskId,
						kind,
						status,
						injectAt
					};
					if (status === 'failed' && handle.lastError) {
						regEvent.error = __makooSerializeError(handle.lastError);
					}
					__makooSend('makoo:runtime:event', {
						runtimeId,
						event: regEvent
					});
					if (status !== 'idle') {
						const changeEvent = {
							name: 'task:statusChange',
							taskId,
							status
						};
						if (status === 'failed' && handle.lastError) {
							changeEvent.error = __makooSerializeError(handle.lastError);
						}
						__makooSend('makoo:runtime:event', {
							runtimeId,
							event: changeEvent
						});
					}
					handle.subscribe(() => {
						try {
							const nextStatus = handle.getSnapshot();
							const payload = {
								name: 'task:statusChange',
								taskId,
								status: nextStatus
							};
							if (nextStatus === 'failed' && handle.lastError) {
								payload.error = __makooSerializeError(handle.lastError);
							}
							__makooSend('makoo:runtime:event', {
								runtimeId,
								event: payload
							});
						} catch {}
					});
				} catch {}
			}
		}
	};

	return makoo;
}
`;
}

export function makooDev(): Plugin {
	let resolvedCoreId: string | null = null;
	const session = new DevSession();

	return {
		name: 'makoo:dev',
		apply: 'serve',
		enforce: 'pre',
		api: { session },
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
		},
		configureServer(server) {
			const bind = (server.config.inlineConfig as InlineConfigWithSession)[bindDevSession];
			bind?.(session);

			server.hot.on('makoo:runtime:open', (payload, client) => {
				session.open(client, payload as RuntimeOpen);
			});
			server.hot.on('makoo:runtime:event', (payload, client) => {
				session.record(client, payload as RuntimeEvent);
			});
			server.hot.on('vite:client:disconnect', (_payload, client) => {
				session.disconnect(client);
			});
		}
	};
}
