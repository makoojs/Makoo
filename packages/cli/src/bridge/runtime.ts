import type { createMakoo, Injection, MakooError, MakooRuntime, StateView } from '@makoojs/core';
import { connectDevframe } from 'devframe/client';
import {
	type DevEndpoint,
	type InjectionSnapshot,
	type PageRuntimeRow,
	type SerializedDiagnostic,
	type SerializedMakooError,
	SUBMIT_PAGE_RPC
} from './protocol';

const MAX_DIAGNOSTICS = 5;
const DEFAULT_RECONNECT_DELAY_MS = 1000;

export type CreateMakooFn = typeof createMakoo;

/** The page-side half of the bridge: accepts whole-table submissions. */
export type PageReporter = {
	submit(rows: PageRuntimeRow[]): void;
	close(): void;
};

type DevframeClientLike = {
	readonly status: string;
	readonly events: {
		on(event: 'connection:status', listener: (status: string) => void): unknown;
	};
	call(method: string, ...args: unknown[]): Promise<unknown>;
	close?(): void;
};

export type DevframeReporterDeps = {
	/** Test seam: fake the devframe client factory. */
	connect?: (endpoint: DevEndpoint) => Promise<DevframeClientLike>;
	reconnectDelayMs?: number;
};

function connectToBridge(endpoint: DevEndpoint): Promise<DevframeClientLike> {
	// The explicit descriptor skips the __connection.json fetch entirely.
	return connectDevframe({
		connection: {
			connectionMeta: {
				backend: 'websocket',
				websocket: `ws://${endpoint.host}:${endpoint.port}/__ws`
			},
			metaBaseUrl: `http://${endpoint.host}:${endpoint.port}/`,
			authToken: endpoint.token
		},
		authToken: endpoint.token,
		// A static token either works or it does not; never block the page on a prompt.
		otpParam: false,
		simpleAuth: false
	}) as Promise<DevframeClientLike>;
}

const liveReporters = new Set<PageReporter>();

/**
 * Page-level reporter: one devframe client per page, whole-table submissions.
 *
 * devframe has no automatic reconnect: on `disconnected` the client is discarded and a new
 * one is created after `reconnectDelayMs`. Every `connected` transition resends the latest
 * table, which is also how a restarted bridge relearns the page. Submissions that arrive
 * while a call is in flight are merged: only the newest pending table is sent next.
 */
export function createDevframeReporter(
	endpoint: DevEndpoint,
	deps: DevframeReporterDeps = {}
): PageReporter {
	const connect = deps.connect ?? connectToBridge;
	const reconnectDelayMs = deps.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;

	let client: DevframeClientLike | undefined;
	let connected = false;
	let inflight = false;
	let latest: PageRuntimeRow[] | undefined;
	// latest has not reached the current client yet.
	let dirty = false;
	let closed = false;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const flush = () => {
		if (closed || !connected || inflight || !dirty || !latest || client === undefined) {
			return;
		}
		const target = client;
		const rows = latest;
		dirty = false;
		inflight = true;
		const done = () => {
			// A dropped client's call may still settle; it must not clobber the new
			// client's in-flight state or re-flush over it.
			if (client !== target) return;
			inflight = false;
			flush();
		};
		try {
			void target.call(SUBMIT_PAGE_RPC, rows).then(done, done);
		} catch {
			done();
		}
	};

	const scheduleRetry = () => {
		if (closed || retryTimer !== undefined) return;
		retryTimer = setTimeout(() => {
			retryTimer = undefined;
			void open();
		}, reconnectDelayMs);
	};

	const dropClient = (retry: boolean) => {
		const stale = client;
		client = undefined;
		connected = false;
		// The dead call may still settle; clearing now would only re-flush, which is fine.
		inflight = false;
		stale?.close?.();
		if (retry) scheduleRetry();
	};

	const onStatus = (owner: DevframeClientLike, status: string) => {
		if (client !== owner) return;
		if (status === 'connected') {
			connected = true;
			dirty = true;
			flush();
			return;
		}
		// A refused token cannot fix itself by retrying; the page needs a reload anyway.
		if (status === 'unauthorized') dropClient(false);
		if (status === 'disconnected' || status === 'error') dropClient(true);
	};

	const open = async () => {
		let next: DevframeClientLike;
		try {
			next = await connect(endpoint);
		} catch {
			scheduleRetry();
			return;
		}
		if (closed) {
			next.close?.();
			return;
		}
		client = next;
		next.events.on('connection:status', (status) => onStatus(next, status));
		onStatus(next, next.status);
	};

	void open();

	const reporter: PageReporter = {
		submit(rows) {
			latest = rows;
			dirty = true;
			flush();
		},
		close() {
			closed = true;
			if (retryTimer !== undefined) {
				clearTimeout(retryTimer);
				retryTimer = undefined;
			}
			dropClient(false);
			liveReporters.delete(reporter);
		}
	};
	liveReporters.add(reporter);
	return reporter;
}

/** Closes every reporter created on this page. Test/teardown hook (e.g. SSR runners). */
export function closePageReporters(): void {
	for (const reporter of [...liveReporters]) reporter.close();
}

function serializeError(error: MakooError): SerializedMakooError;
function serializeError(error: MakooError | undefined): SerializedMakooError | undefined;
function serializeError(error: MakooError | undefined): SerializedMakooError | undefined {
	if (error === undefined) return undefined;
	const serialized: SerializedMakooError = { code: error.code, message: error.message };
	if (error.cause !== undefined) {
		serialized.cause = error.cause instanceof Error ? error.cause.message : String(error.cause);
	}
	return serialized;
}

type SnapshotOf = <T>(handle: StateView<T>) => Readonly<T>;

type WatchedRuntime = {
	// Core cannot enumerate an instance's injections, so applied ones are tracked by name.
	injections: Map<string, Injection>;
	diagnostics: SerializedDiagnostic[];
};

function snapshotInjection(
	name: string,
	injection: Injection,
	snapshotOf: SnapshotOf
): InjectionSnapshot {
	const lastError = serializeError(injection.statusHandle.lastError);
	switch (injection.kind) {
		case 'component': {
			const handle = injection.statusHandle;
			return {
				name,
				kind: 'component',
				status: snapshotOf(handle),
				lastError,
				attachedListeners: handle.attachedListenerNames.map((listenerName) => ({
					name: listenerName,
					status: snapshotOf(handle.attachedListener(listenerName))
				}))
			};
		}
		case 'component-each':
			return {
				name,
				kind: 'component-each',
				status: snapshotOf(injection.statusHandle),
				lastError,
				// Core emits no child-added event: reading children on every submission is
				// what discovers new ones, and reading subscribes them.
				children: injection.children.map((child) => ({
					status: snapshotOf(child.statusHandle),
					lastError: serializeError(child.statusHandle.lastError)
				}))
			};
		case 'listener':
			return {
				name,
				kind: 'standalone-listener',
				status: snapshotOf(injection.statusHandle),
				lastError
			};
	}
}

/**
 * Wraps `createMakoo` so every Core Instance on the page reports its complete injection
 * table through `reporter`. Pure: no globals, no knowledge of the virtual module.
 */
export function instrument(
	base: CreateMakooFn,
	endpoint: DevEndpoint,
	reporter: PageReporter = createDevframeReporter(endpoint)
): CreateMakooFn {
	let nextRuntimeId = 1;
	const runtimes = new Map<number, WatchedRuntime>();
	// Subscriptions follow the table: every status handle a snapshot reads is subscribed,
	// and handles that drop out of the table (removed injections, gone children) are released.
	const subscriptions = new Map<StateView<unknown>, () => void>();

	const submit = () => {
		const seen = new Set<StateView<unknown>>();
		const snapshotOf: SnapshotOf = (handle) => {
			seen.add(handle);
			return handle.getSnapshot();
		};
		const rows = [...runtimes].map(([runtimeId, row]) => ({
			runtimeId,
			injections: [...row.injections].map(([name, injection]) =>
				snapshotInjection(name, injection, snapshotOf)
			),
			diagnostics: row.diagnostics
		}));
		for (const handle of seen) {
			if (!subscriptions.has(handle)) subscriptions.set(handle, handle.subscribe(submit));
		}
		for (const [handle, unsubscribe] of subscriptions) {
			if (seen.has(handle)) continue;
			unsubscribe();
			subscriptions.delete(handle);
		}
		reporter.submit(rows);
	};

	return function instrumentedCreateMakoo(): MakooRuntime {
		const runtime = base();
		const runtimeId = nextRuntimeId++;
		const row: WatchedRuntime = { injections: new Map(), diagnostics: [] };
		runtimes.set(runtimeId, row);
		submit();

		runtime.observe((notice) => {
			if (notice.type === 'injection-removed') {
				row.injections.delete(notice.name);
			} else if (notice.type === 'instance-disposed') {
				runtimes.delete(runtimeId);
			} else {
				row.diagnostics.push({
					type: 'diagnostic',
					name: notice.name,
					error: serializeError(notice.error)
				});
				if (row.diagnostics.length > MAX_DIAGNOSTICS) row.diagnostics.shift();
			}
			submit();
		});

		return {
			...runtime,
			apply(declarations) {
				runtime.apply(declarations);
				for (const { kind, name } of declarations) {
					try {
						row.injections.set(
							name,
							kind === 'listener' ? runtime.listener(name) : runtime.injection(name)
						);
					} catch {
						// An earlier mount in the same batch may have already removed this injection.
					}
				}
				submit();
			}
		};
	};
}
