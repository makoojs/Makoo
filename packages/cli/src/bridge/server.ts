import { randomBytes } from 'node:crypto';
import type { DevframeNodeContext } from 'devframe';
import type { DevframeAuthHandler } from 'devframe/node/auth';
import { loadCliVersion } from '../commands/version';
import { type DevEndpoint, type PageRuntimeRow, SUBMIT_PAGE_RPC } from './protocol';
import type { RuntimeStore } from './store';

export type BridgeAddress = {
	host: string;
	port: number;
};

export type DevBridge = {
	endpoint: DevEndpoint;
	close: () => Promise<void>;
};

// Process-level token: generated once so a Vite restart keeps the same endpoint.
const token = randomBytes(16).toString('hex');

/**
 * Start the devframe bridge (bridge mode: `__connection.json` + WS only).
 * devframe itself is loaded lazily so build/preview paths never pull it in.
 */
export async function startDevBridge(
	store: RuntimeStore,
	address: BridgeAddress
): Promise<DevBridge> {
	const { createDevServer } = await import('devframe/adapters/dev');
	const { defineDevframe, defineRpcFunction } = await import('devframe');
	const { createInteractiveAuth } = await import('devframe/recipes/interactive-auth');
	const version = await loadCliVersion();

	let context: DevframeNodeContext | undefined;

	const submitPage = defineRpcFunction({
		name: SUBMIT_PAGE_RPC,
		type: 'action',
		handler: (rows: PageRuntimeRow[]) => {
			// getCurrentRpcSession is the handler's only handle on the caller;
			// a call it cannot attribute is dropped rather than misattributed.
			const connectionId = context?.rpc.getCurrentRpcSession()?.meta?.id;
			if (connectionId === undefined) return;
			store.replacePage(connectionId, rows);
		}
	});

	const definition = defineDevframe({
		id: 'makoo',
		name: 'Makoo',
		version,
		packageName: '@makoojs/cli',
		homepage: 'https://github.com/makoojs/Makoo',
		description: 'Makoo userscript development bridge',
		importMetaUrl: import.meta.url,
		setup(ctx) {
			context = ctx;
			ctx.rpc.register(submitPage);
		}
	});

	const server = await createDevServer(definition, {
		host: address.host,
		port: address.port,
		// The runtime accepts a ctx factory; the 1.2.6 types only declare a handler.
		auth: ((ctx: DevframeNodeContext) =>
			createInteractiveAuth(ctx, {
				clientAuthTokens: [token],
				banner: () => {}
			})) as unknown as DevframeAuthHandler,
		allowedOrigins: false,
		sse: false,
		mcp: false,
		onPeerDisconnect: (_connection, meta) => {
			store.disconnect(meta.id);
		}
	});

	return {
		endpoint: { host: address.host, port: address.port, token },
		close: () => server.close()
	};
}
