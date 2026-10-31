import { isIP } from 'node:net';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import { type BridgeAddress, type DevBridge, startDevBridge } from '../bridge/server';
import { RuntimeStore } from '../bridge/store';
import type { DevTerminal, RuntimeSource } from '../tui/DevTerminal';

const VIRTUAL_CORE_ID = '\0virtual:makoo-dev';
const CORE_PACKAGE = '@makoojs/core';
const PLUGIN_NAME = 'makoo:dev';

export type MakooDevOptions = {
	/** Bridge listen port, fixed (no scanning). Default 9999. */
	port?: number;
	/** Bridge listen host: an IPv4/IPv6 literal or 'localhost'. Default '127.0.0.1'. */
	host?: string;
};

export type MakooDevDeps = {
	address: BridgeAddress;
	startBridge: (store: RuntimeStore, address: BridgeAddress) => Promise<DevBridge>;
	createTerminal: (server: ViteDevServer, store: RuntimeSource) => Promise<DevTerminal>;
};

// CLI-driven state rides on inlineConfig: Vite keeps that object across a
// restart, so the flag survives new plugin instances but stays scoped to this
// server's config chain instead of leaking to unrelated servers in-process.
const cliDrivenConfigs = new WeakSet<InlineConfig>();

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

// A pure forward until the page runtime (ticket 04) wraps createMakoo.
function buildVirtualModuleSource(resolvedCoreId: string): string {
	return `export * from ${JSON.stringify(resolvedCoreId)};`;
}

export function createMakooDev(deps: MakooDevDeps): Plugin {
	const { address, startBridge, createTerminal } = deps;
	const store = new RuntimeStore();
	const terminals = new Map<ViteDevServer, Promise<DevTerminal>>();
	let resolvedCoreId: string | null = null;
	let bridge: Promise<DevBridge> | undefined;
	let disabled = false;

	const launchBridge = async (server: ViteDevServer) => {
		try {
			bridge = startBridge(store, address);
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
		// warining this IP is connect the external machine
		if (!isLoopbackHost(address.host)) {
			server.config.logger.warn(
				`[makoo] the makooDev bridge is listening on ${address.host}:${address.port}, reachable beyond this machine; access is protected by token only.`
			);
		}
	};

	// One terminal per server instance: a restart hands the plugin object a new
	// server, and closeBundle (which carries no server reference) drops the map.
	const withTerminal = (server: ViteDevServer, run: (t: DevTerminal) => void | Promise<void>) => {
		let pending = terminals.get(server);
		if (pending === undefined) {
			// Wrap so a synchronous throw from createTerminal becomes a rejection.
			pending = Promise.resolve().then(() => createTerminal(server, store));
			terminals.set(server, pending);
		}
		void pending.then(run).catch((error: unknown) => {
			server.config.logger.warn(
				`[makoo] the dev terminal failed (${error instanceof Error ? error.message : String(error)})`
			);
		});
	};

	const plugin: Plugin = {
		name: PLUGIN_NAME,
		apply: 'serve',
		enforce: 'pre',
		configResolved(config) {
			const first = config.plugins.findIndex((p) => p.name === PLUGIN_NAME);
			// Check if there are any extra makoodev plugins running.
			if (config.plugins.indexOf(plugin) !== first) {
				disabled = true;
				config.logger.warn(
					'[makoo] makooDev() is registered more than once; keeping the first instance active.'
				);
			}
		},
		async resolveId(source, importer, options) {
			if (disabled || source !== CORE_PACKAGE) {
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
			if (disabled || id !== VIRTUAL_CORE_ID) {
				return null;
			}
			if (!resolvedCoreId) {
				return null;
			}
			return buildVirtualModuleSource(resolvedCoreId);
		},
		configureServer(server) {
			if (disabled) return;
			const { httpServer } = server;
			if (!httpServer) {
				server.config.logger.warn(
					'[makoo] makooDev does not support middleware mode; the bridge and terminal stay off.'
				);
				return;
			}

			// Taking over means replacing the two CLI-facing methods.
			if (
				typeof server.printUrls !== 'function' ||
				typeof server.bindCLIShortcuts !== 'function'
			) {
				httpServer.once('listening', () => void launchBridge(server));
				return;
			}
			const originalPrintUrls = server.printUrls;
			const originalBindCLIShortcuts = server.bindCLIShortcuts;

			const printUrls = () => withTerminal(server, (t) => t.showHome());
			const bindCLIShortcuts = () => {
				cliDrivenConfigs.add(server.config.inlineConfig);
				withTerminal(server, (t) => t.activate());
			};
			server.printUrls = printUrls;
			server.bindCLIShortcuts = bindCLIShortcuts;

			// The listening event fires after the old instance was killed.
			httpServer.once('listening', () => {
				void launchBridge(server);
				if (
					server.printUrls !== printUrls ||
					server.bindCLIShortcuts !== bindCLIShortcuts
				) {
					// Someone else claimed the terminal: hand our half back before
					// yielding, so neither override keeps firing.
					if (server.printUrls === printUrls) server.printUrls = originalPrintUrls;
					if (server.bindCLIShortcuts === bindCLIShortcuts) {
						server.bindCLIShortcuts = originalBindCLIShortcuts;
					}
					server.config.logger.warn(
						'[makoo] another plugin overrode printUrls/bindCLIShortcuts; the makooDev terminal stays inactive while the bridge keeps running.'
					);
					return;
				}
				// On a restart nobody calls bindCLIShortcuts again; an earlier CLI
				// call on this config chain left the flag set, so take the terminal
				// back over.
				if (cliDrivenConfigs.has(server.config.inlineConfig)) {
					withTerminal(server, async (t) => {
						await t.showHome();
						t.activate();
					});
				}
			});
		},
		// Runs once per environment; dropping the references before awaiting keeps
		// repeated calls idempotent.
		async closeBundle() {
			const pendingTerminals = [...terminals.values()];
			terminals.clear();
			const pendingBridge = bridge;
			bridge = undefined;
			for (const pending of pendingTerminals) {
				await pending.then(
					(t) => t.close(),
					() => {}
				);
			}
			await pendingBridge?.then(
				(started) => started.close(),
				() => {}
			);
		}
	};
	return plugin;
}

/**
 * Reports the Core Instances on the page, and the status and errors of each injection, to the
 * `makoo dev` terminal. Only active in the dev server; it never controls injections.
 */
export function makooDev(options: MakooDevOptions = {}): Plugin {
	return createMakooDev({
		address: resolveBridgeAddress(options),
		startBridge: startDevBridge,
		// The TUI (and its log-update dependency) is imported lazily so
		// build/preview and plugin-less paths never load it.
		createTerminal: async (server, store) => {
			const { DevTerminal } = await import('../tui/DevTerminal');
			return new DevTerminal(server, store);
		}
	});
}
