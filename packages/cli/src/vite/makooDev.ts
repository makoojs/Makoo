import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import { join } from 'node:path';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import type { DevEndpoint } from '../bridge/protocol';
import { type BridgeAddress, type DevBridge, startDevBridge } from '../bridge/server';
import { RuntimeStore } from '../bridge/store';
import type { DevTerminal, RuntimeSource } from '../tui/DevTerminal';

const VIRTUAL_CORE_ID = '\0virtual:makoo-dev';
const CORE_PACKAGE = '@makoojs/core';
const DEVFRAME_CLIENT_PACKAGE = 'devframe/client';
const PLUGIN_NAME = 'makoo:dev';

export type MakooDevOptions = {
	/** Bridge listen port, fixed (no scanning). Default 9999. */
	port?: number;
	/** Bridge listen host: an IPv4/IPv6 literal or 'localhost'. Default '127.0.0.1'. */
	host?: string;
};

export type MakooDevDeps = {
	address: BridgeAddress;
	/**
	 * Absolute path to the page-side instrument module imported by the virtual
	 * module; undefined = instrumentation unavailable, the module stays a pure
	 * re-export of core.
	 */
	runtimeFile: string | undefined;
	startBridge: (store: RuntimeStore, address: BridgeAddress) => Promise<DevBridge>;
	createTerminal: (server: ViteDevServer, store: RuntimeSource) => Promise<DevTerminal>;
	/** Resolves 'devframe/client' to an absolute path; throws when unresolvable. */
	resolveDevframeClient: () => string;
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

function buildPassthroughSource(resolvedCoreId: string): string {
	return `export * from ${JSON.stringify(resolvedCoreId)};`;
}

// Thin wrapper: re-export everything, then shadow createMakoo with the instrumented one.
function buildVirtualModuleSource(
	resolvedCoreId: string,
	runtimeFile: string,
	endpoint: DevEndpoint
): string {
	const core = JSON.stringify(resolvedCoreId);
	return [
		`export * from ${core};`,
		`import { createMakoo as __makooBaseCreateMakoo } from ${core};`,
		`import { instrument as __makooInstrument } from ${JSON.stringify(runtimeFile)};`,
		`export const createMakoo = __makooInstrument(__makooBaseCreateMakoo, ${JSON.stringify(endpoint)});`
	].join('\n');
}

export function createMakooDev(deps: MakooDevDeps): Plugin {
	const { address, startBridge, createTerminal } = deps;
	const store = new RuntimeStore();
	const terminals = new Map<ViteDevServer, Promise<DevTerminal>>();
	let resolvedCoreId: string | null = null;
	let bridge: Promise<DevBridge> | undefined;
	let disabled = false;
	let devServer: ViteDevServer | undefined;
	// undefined = not tried yet; null = resolution failed (degrade to passthrough).
	let devframeClientId: string | null | undefined;

	const resolveDevframeClientId = (): string | null => {
		if (devframeClientId === undefined) {
			try {
				devframeClientId = deps.resolveDevframeClient();
			} catch {
				devframeClientId = null;
			}
		}
		return devframeClientId;
	};

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
		config() {
			return {
				// The bare specifier only appears inside our runtime module, whose
				// resolveId already returns an absolute path; exclusion is a belt for
				// the scanner paths that bypass this plugin's resolution.
				optimizeDeps: { exclude: [DEVFRAME_CLIENT_PACKAGE] }
			};
		},
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
			if (disabled) {
				return null;
			}
			// devframe is a cli dependency, not the user's: pinning our own import of it
			// to this package's slot keeps the page on the same version as the bridge,
			// while leaving the user's own devframe imports to normal resolution.
			if (source === DEVFRAME_CLIENT_PACKAGE && importer === deps.runtimeFile) {
				return resolveDevframeClientId();
			}
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
		async load(id) {
			if (disabled || id !== VIRTUAL_CORE_ID || resolvedCoreId === null) {
				return null;
			}
			// Wait for the bridge startup result: an in-flight launch settles before
			// the module source is generated; failure degrades to a pure forward.
			const started = await bridge?.catch(() => undefined);
			if (started === undefined) {
				return buildPassthroughSource(resolvedCoreId);
			}
			if (deps.runtimeFile === undefined) {
				devServer?.config.logger.warn(
					'[makoo] the page runtime module could not be located; serving @makoojs/core without instrumentation.'
				);
				return buildPassthroughSource(resolvedCoreId);
			}
			if (resolveDevframeClientId() === null) {
				devServer?.config.logger.warn(
					'[makoo] devframe/client could not be resolved; serving @makoojs/core without instrumentation.'
				);
				return buildPassthroughSource(resolvedCoreId);
			}
			return buildVirtualModuleSource(resolvedCoreId, deps.runtimeFile, started.endpoint);
		},
		configureServer(server) {
			if (disabled) return;
			devServer = server;
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
	// The module's own directory locates both the sibling instrument module
	// (dist/bridge/runtime.js) and, via createRequire, this package's devframe
	// dependency slot. import.meta.dirname covers ESM (Node >= 20.11); the cjs
	// bundle has import.meta = {} but a real __dirname. A runtime with neither
	// degrades to passthrough.
	const moduleDir =
		import.meta.dirname ?? (typeof __dirname !== 'undefined' ? __dirname : undefined);
	return createMakooDev({
		address: resolveBridgeAddress(options),
		runtimeFile: moduleDir === undefined ? undefined : join(moduleDir, 'bridge/runtime.js'),
		startBridge: startDevBridge,
		resolveDevframeClient: () => {
			if (moduleDir === undefined) {
				throw new Error('module location unavailable');
			}
			return createRequire(join(moduleDir, 'index.js')).resolve(DEVFRAME_CLIENT_PACKAGE);
		},
		// The TUI (and its log-update dependency) is imported lazily so
		// build/preview and plugin-less paths never load it.
		createTerminal: async (server, store) => {
			const { DevTerminal } = await import('../tui/DevTerminal');
			return new DevTerminal(server, store);
		}
	});
}
