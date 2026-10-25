import type { MountAdapter } from '../adapter/types';
import type { DOMObserver } from '../dom/observer';
import { MakooErrorCode } from '../error/ErrorCode';
import { injectionCleanupFailed, MakooError, stateSubscriberFailed } from '../error/MakooError';
import type { ListenerInjection } from '../listener/types';
import { createState } from '../state/createState';
import { type ComponentExecutionControl, createChildExecution } from './execution';
import type {
	ChildInjection,
	ComponentEachInjection,
	ComponentEachStatus,
	ComponentStatus,
	MakooComponentEachDeclaration
} from './types';

type ComponentEach = {
	readonly config: MakooComponentEachDeclaration;
	readonly dom: DOMObserver;
	readonly adapter: MountAdapter;
	readonly onRemoved: () => void;
	readonly isDisposed: () => boolean;
	readonly listener: (name: string) => ListenerInjection;
	readonly onDiagnostic: (name: string, error: MakooError) => void;
	readonly state: ReturnType<typeof createState<ComponentEachStatus>>;
	readonly children: Child[];
	claimed: Set<Element>;
	intent: 'running' | 'stopped' | 'removed';
	lastError: MakooError | undefined;
	childCount: number;
	collector: AbortController | undefined;
	cleanup: Promise<void>;
	cleaning: boolean;
	closed: boolean;
};

type Child = {
	readonly name: string;
	readonly element: Element;
	readonly injection: ChildInjection;
	readonly state: ReturnType<typeof createState<ComponentStatus>>;
	readonly execution: ComponentExecutionControl;
	readonly cleanup: {
		promise: Promise<void>;
		resolve: () => void;
		reject: (error: MakooError) => void;
	};
	phase: 'running' | 'cancelling' | 'ended';
	lastError: MakooError | undefined;
};

export function createComponentEach(
	config: MakooComponentEachDeclaration,
	adapter: MountAdapter,
	dom: DOMObserver,
	onRemoved: () => void,
	isDisposed: () => boolean,
	listener: (name: string) => ListenerInjection,
	onDiagnostic: (name: string, error: MakooError) => void
): ComponentEachInjection {
	const each: ComponentEach = {
		config,
		dom,
		adapter,
		onRemoved,
		isDisposed,
		listener,
		onDiagnostic,
		state: createState<ComponentEachStatus>('idle', (cause) => {
			const error = stateSubscriberFailed(`"${config.name}"`, cause);
			console.error(error);
			onDiagnostic(config.name, error);
		}),
		children: [],
		claimed: new Set(),
		intent: 'stopped',
		lastError: undefined,
		childCount: 0,
		collector: undefined,
		cleanup: Promise.resolve(),
		cleaning: false,
		closed: false
	};
	return {
		kind: 'component-each',
		command: Object.freeze({
			name: config.name,
			start: () => startEach(each),
			stop: () => stopEach(each),
			remove: () => removeEach(each)
		}),
		statusHandle: Object.freeze({
			...each.state.view,
			get lastError() {
				return each.lastError;
			}
		}),
		get children() {
			return each.children.map((child) => child.injection);
		}
	};
}

function startEach(each: ComponentEach): void {
	const { name } = each.config;
	if (each.isDisposed()) {
		throw new MakooError('Core instance is disposed', {
			code: MakooErrorCode.INSTANCE_DISPOSED
		});
	}
	if (each.closed) {
		throw new MakooError(`Injection "${name}" cannot restart after cleanup failed`, {
			code: MakooErrorCode.INJECTION_CLOSED
		});
	}
	if (each.intent === 'removed') {
		throw new MakooError(`Injection "${name}" was removed`, {
			code: MakooErrorCode.INJECTION_REMOVED
		});
	}
	if (each.intent === 'running') return;
	each.intent = 'running';
	if (!each.cleaning) startCollecting(each);
}

function startCollecting(each: ComponentEach): void {
	each.lastError = undefined;
	each.claimed = new Set();
	each.state.set('collecting');
	collect(each);
	if (each.intent !== 'running') return;
	each.collector = new AbortController();
	each.dom.subscribe(() => collect(each), each.collector.signal);
}

function stopCollecting(each: ComponentEach): void {
	each.collector?.abort();
	each.collector = undefined;
}

function collect(each: ComponentEach): void {
	let matches: NodeListOf<Element>;
	try {
		matches = document.querySelectorAll(each.config.injectAt);
	} catch (cause) {
		failEach(
			each,
			new MakooError(`Failed to collect matches for "${each.config.name}"`, {
				code: MakooErrorCode.MOUNT_FAILED,
				cause
			})
		);
		return;
	}
	for (const element of matches) {
		if (each.intent !== 'running') return;
		if (element.isConnected && !each.claimed.has(element)) startChild(each, element);
	}
}

function failEach(each: ComponentEach, error: MakooError): void {
	each.intent = 'stopped';
	stopCollecting(each);
	each.lastError = error;
	console.error(error);
	void cleanUp(each, () => stopChildren(each, 'failed')).catch(() => {});
	each.state.set('failed');
}

function stopEach(each: ComponentEach): Promise<void> {
	if (each.closed || each.intent === 'removed') return each.cleanup;
	each.intent = 'stopped';
	stopCollecting(each);
	return cleanUp(each, () => stopChildren(each));
}

function removeEach(each: ComponentEach): Promise<void> {
	if (each.closed || each.intent === 'removed') return each.cleanup;
	each.intent = 'removed';
	stopCollecting(each);
	if (!each.cleaning && each.children.length === 0) {
		each.state.set('idle');
		each.onRemoved();
		return each.cleanup;
	}
	return cleanUp(each, () => stopChildren(each).then(() => each.onRemoved()));
}

function cleanUp(each: ComponentEach, work: () => Promise<void>): Promise<void> {
	const cleanup = each.cleaning ? each.cleanup.then(work) : work();
	each.cleaning = true;
	each.cleanup = cleanup;
	void cleanup.then(
		() => {
			if (each.cleanup !== cleanup) return;
			each.cleaning = false;
			if (each.intent === 'running') startCollecting(each);
		},
		() => {
			if (each.cleanup === cleanup) each.cleaning = false;
		}
	);
	return cleanup;
}

async function stopChildren(
	each: ComponentEach,
	settled: 'idle' | 'failed' = 'idle'
): Promise<void> {
	const errors: unknown[] = [];
	for (const child of [...each.children]) {
		await stopChild(each, child).catch((error: unknown) => errors.push(error));
	}
	if (errors.length > 0) {
		const failure = injectionCleanupFailed(each.config.name, errors);
		each.lastError = failure;
		each.closed = true;
		each.state.set('failed');
		console.error(failure);
		throw failure;
	}
	if (each.intent !== 'running') each.state.set(settled);
}

function startChild(each: ComponentEach, element: Element): void {
	const name = `${each.config.name}#${++each.childCount}`;
	const state = createState<ComponentStatus>('idle', (cause) => {
		const error = stateSubscriberFailed(`"${name}"`, cause);
		console.error(error);
		each.onDiagnostic(each.config.name, error);
	});
	const injection: ChildInjection = {
		kind: 'component',
		command: Object.freeze({
			name,
			start: () => {
				if (each.isDisposed()) {
					throw new MakooError('Core instance is disposed', {
						code: MakooErrorCode.INSTANCE_DISPOSED
					});
				}
				if (child.phase === 'ended') {
					throw new MakooError(`Injection "${name}" was removed`, {
						code: MakooErrorCode.INJECTION_REMOVED
					});
				}
			},
			stop: () => stopChild(each, child),
			remove: () => stopChild(each, child)
		}),
		statusHandle: Object.freeze({
			...state.view,
			get lastError() {
				return child.lastError;
			},
			attachedListenerNames: Object.freeze([]),
			attachedListener: (listenerName: string) => {
				throw new MakooError(`Unknown listener "${listenerName}" in "${name}"`, {
					code: MakooErrorCode.LISTENER_NOT_FOUND
				});
			}
		})
	};
	let resolveCleanup!: () => void;
	let rejectCleanup!: (error: MakooError) => void;
	const cleanupPromise = new Promise<void>((resolve, reject) => {
		resolveCleanup = resolve;
		rejectCleanup = reject;
	});
	void cleanupPromise.catch(() => {});
	const child: Child = {
		name,
		element,
		injection,
		state,
		cleanup: { promise: cleanupPromise, resolve: resolveCleanup, reject: rejectCleanup },
		phase: 'running',
		lastError: undefined,
		execution: createChildExecution(
			name,
			element,
			each.dom,
			{
				mount: (container) =>
					each.adapter.mount({
						component: each.config.component,
						props: each.config.props,
						container,
						injection,
						listener: each.listener
					}),
				unmount: (mountHandle) => each.adapter.unmount(mountHandle)
			},
			new Map(),
			{
				setStatus: (status) => {
					if (child.phase === 'running') child.state.set(status);
				},
				ended: (reason, error) => {
					void endChild(each, child, reason, error).catch(() => {});
				}
			}
		)
	};
	each.claimed.add(element);
	// Keep `children` snapshots in document order under continuous collect.
	const index = each.children.findIndex(
		(other) => other.element.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING
	);
	each.children.splice(index === -1 ? each.children.length : index, 0, child);
	child.execution.start();
}

function stopChild(each: ComponentEach, child: Child): Promise<void> {
	if (child.phase !== 'running') return child.cleanup.promise;
	if (child.execution.phase === 'mounting') {
		child.phase = 'cancelling';
		child.execution.cancel();
		return child.cleanup.promise;
	}
	return endChild(each, child, 'stopped');
}

async function endChild(
	each: ComponentEach,
	child: Child,
	reason: 'stopped' | 'detached' | 'failed',
	error?: MakooError
): Promise<void> {
	if (child.phase === 'ended') return child.cleanup.promise;
	child.phase = 'ended';
	// Leave the live set before awaiting cleanup so children snapshots drop immediately.
	each.children.splice(each.children.indexOf(child), 1);
	if (reason === 'detached') each.claimed.delete(child.element);
	const cleanupErrors = await child.execution.finish();
	if (cleanupErrors.length > 0) {
		const failure = injectionCleanupFailed(
			child.name,
			error ? [error, ...cleanupErrors] : cleanupErrors
		);
		child.lastError = failure;
		child.cleanup.reject(failure);
		console.error(failure);
		child.state.set('failed');
		throw failure;
	}
	child.cleanup.resolve();
	if (error) {
		child.lastError = error;
		console.error(error);
	}
	child.state.set(reason === 'stopped' ? 'idle' : 'failed');
}
