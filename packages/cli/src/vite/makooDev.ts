import { isIP } from 'node:net';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import { type BridgeAddress, type DevBridge, startDevBridge } from '../bridge/server';
import { RuntimeStore } from '../bridge/store';
import type { RuntimeInjection, RuntimeNotice, RuntimeOpen } from './session';
import { DevSession } from './session';

const VIRTUAL_CORE_ID = '\0virtual:makoo-dev';
const CORE_PACKAGE = '@makoojs/core';
const RUNTIME_EVENT = {
	open: 'makoo:runtime:open',
	injection: 'makoo:runtime:injection',
	notice: 'makoo:runtime:notice'
} as const;

export const bindDevSession = Symbol('makooDev.bindSession');

export type InlineConfigWithSession = InlineConfig & {
	[bindDevSession]?: (session: DevSession) => void;
};

export type MakooDevOptions = {
	/** Bridge listen port, fixed (no scanning). Default 9999. */
	port?: number;
	/** Bridge listen host: an IPv4/IPv6 literal or 'localhost'. Default '127.0.0.1'. */
	host?: string;
};

function resolveBridgeAddress(options: MakooDevOptions): BridgeAddress {
	const port = options.port ?? 9999;
	const host = options.host ?? '127.0.0.1';
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(
			`makooDev: invalid port ${String(options.port)}; expected an integer between 1 and 65535.`
		);
	}
	if (host !== 'localhost' && isIP(host) === 0) {
		throw new Error(
			`makooDev: invalid host ${JSON.stringify(options.host)}; expected an IPv4/IPv6 literal or 'localhost'.`
		);
	}
	return { host, port };
}

function isLoopbackHost(host: string): boolean {
	return host === 'localhost' || host === '::1' || host.startsWith('127.');
}

// The wrapper only reads public Status Handles and Instance Observation; it never starts, stops, or removes injections.
// HMR cleanup is left to Vite on purpose (ADR 0004).
function buildVirtualModuleSource(resolvedCoreId: string): string {
	const coreId = JSON.stringify(resolvedCoreId);

	return `
export * from ${coreId};
import { createMakoo as __makooCreateMakoo } from ${coreId};

function __makooSend(event, payload) {
	try {
		import.meta.hot?.send(event, payload);
	} catch {
		// Session transport failures must not affect the user runtime.
	}
}

function __makooSerializeError(error) {
	const serialized = { code: error.code, message: error.message };
	if (error.cause !== undefined) {
		serialized.cause = error.cause instanceof Error ? error.cause.message : String(error.cause);
	}
	return serialized;
}

function __makooSnapshotInjection(declaration, statusHandle) {
	const isComponent = declaration.kind === 'component';
	const snapshot = {
		name: declaration.name,
		kind: isComponent ? 'component' : 'standalone-listener',
		status: statusHandle.getSnapshot()
	};
	if (statusHandle.lastError) snapshot.lastError = __makooSerializeError(statusHandle.lastError);
	if (isComponent) {
		snapshot.attachedListeners = statusHandle.attachedListenerNames.map((listenerName) => ({
			name: listenerName,
			status: statusHandle.attachedListener(listenerName).getSnapshot()
		}));
	}
	return snapshot;
}

function __makooSerializeNotice(notice) {
	if (notice.type !== 'diagnostic') return notice;
	return { ...notice, error: __makooSerializeError(notice.error) };
}

function __makooWatchInjection(runtime, runtimeId, declaration) {
	let statusHandle;
	try {
		statusHandle =
			declaration.kind === 'component'
				? runtime.injection(declaration.name).statusHandle
				: runtime.listener(declaration.name).statusHandle;
	} catch {
		// An earlier mount in the same batch already removed this injection.
		return;
	}
	const push = () => {
		__makooSend('${RUNTIME_EVENT.injection}', {
			runtimeId,
			injection: __makooSnapshotInjection(declaration, statusHandle)
		});
	};
	push();
	statusHandle.subscribe(push);
	if (declaration.kind === 'component') {
		for (const listenerName of statusHandle.attachedListenerNames) {
			statusHandle.attachedListener(listenerName).subscribe(push);
		}
	}
}

let __makooNextRuntimeId = 1;

export function createMakoo() {
	const runtime = __makooCreateMakoo();
	const runtimeId = __makooNextRuntimeId++;
	__makooSend('${RUNTIME_EVENT.open}', { runtimeId });
	runtime.observe((notice) => {
		__makooSend('${RUNTIME_EVENT.notice}', { runtimeId, notice: __makooSerializeNotice(notice) });
	});
	return {
		...runtime,
		apply(declarations) {
			runtime.apply(declarations);
			for (const declaration of declarations) {
				__makooWatchInjection(runtime, runtimeId, declaration);
			}
		}
	};
}
`;
}

/**
 * Reports the Core Instances on the page, and the status and errors of each injection, to the
 * `makoo dev` terminal. Only active in the dev server; it never controls injections.
 */
export function makooDev(options: MakooDevOptions = {}): Plugin {
	const address = resolveBridgeAddress(options);
	let resolvedCoreId: string | null = null;
	const session = new DevSession();
	const store = new RuntimeStore();
	let bridge: Promise<DevBridge> | undefined;

	const startBridge = async (server: ViteDevServer) => {
		try {
			bridge = startDevBridge(store, address);
			await bridge;
		} catch (error) {
			bridge = undefined;
			// devframe rejects a failed bind with code DF0052 wrapping EADDRINUSE.
			const code = (error as { code?: unknown })?.code;
			const logger = server.config.logger;
			if (code === 'EADDRINUSE' || code === 'DF0052') {
				logger.warn(
					`[makoo] port ${address.port} on ${address.host} is already in use; the makooDev bridge was not started. Configure another port with makooDev({ port }).`
				);
			} else {
				logger.warn(
					`[makoo] the makooDev bridge failed to start (${error instanceof Error ? error.message : String(error)}); continuing without it.`
				);
			}
			return;
		}
		if (!isLoopbackHost(address.host)) {
			server.config.logger.warn(
				`[makoo] the makooDev bridge is listening on ${address.host}:${address.port}, reachable beyond this machine; access is protected by token only.`
			);
		}
	};

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

			for (const environment of Object.values(server.environments)) {
				const { hot } = environment;
				hot.on(RUNTIME_EVENT.open, (payload, client) => {
					session.open(client, payload as RuntimeOpen);
				});
				hot.on(RUNTIME_EVENT.injection, (payload, client) => {
					session.updateInjection(client, payload as RuntimeInjection);
				});
				hot.on(RUNTIME_EVENT.notice, (payload, client) => {
					session.applyNotice(client, payload as RuntimeNotice);
				});
				hot.on('vite:client:disconnect', (_payload, client) => {
					session.disconnect(client);
				});
			}

			const { httpServer } = server;
			if (httpServer) {
				// listening event is active when the old instance be killed
				httpServer.once('listening', () => {
					void startBridge(server);
				});
			} else {
				// middleware mode
				void startBridge(server);
			}
		},
		// Runs once per environment; nulling `bridge` before awaiting keeps it idempotent.
		async closeBundle() {
			const pending = bridge;
			bridge = undefined;
			await pending?.then(
				(started) => started.close(),
				() => {}
			);
		}
	};
}
