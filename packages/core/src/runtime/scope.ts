/**
 * The lifecycle ownership tree. Every resource registers on a scope; stopping a scope
 * ends its child scopes first, then runs its own cleanups in reverse registration order.
 * Supervision is a spawn-time option: under `escalate` a child's failure or cleanup
 * errors end the parent with them; under `isolate` they stay on the child.
 */
type ScopeNode = {
	-readonly [K in keyof Scope]: Scope[K];
} & {
	// Tree structure
	childScopes: Set<ScopeNode>;
	parent: ScopeNode | undefined;
	tree: { depth: number };

	// Teardown
	cleanupErrors: unknown[];
	cleanups: (() => void)[];

	// Options
	ended: ((outcome: ScopeOutcome) => void) | undefined;
	supervision: 'escalate' | 'isolate';
	uncaughtSetupError: (cause: unknown) => void;
};

export type Scope = {
	// Ending
	fail(error: unknown): void;
	leave(): void;
	stop(): void;

	// Registration
	/** Merges cleanup errors collected elsewhere into this scope's outcome (used by `match`). */
	addCleanupErrors(errors: readonly unknown[]): void;
	onCleanup(fn: () => void): void;
	spawn(options: ScopeOptions): Scope;

	// State
	readonly isEnded: boolean;
	/** Whether any scope in this tree is running setup or teardown right now. */
	readonly isTransitioning: boolean;
	readonly outcome: ScopeOutcome | undefined;
};

export type ScopeOptions = {
	// Behavior
	readonly setup?: (scope: Scope) => void;
	readonly supervision?: 'escalate' | 'isolate';

	// Callbacks
	readonly ended?: (outcome: ScopeOutcome) => void;
	/**
	 * Called when `setup` throws after this scope has already ended — typically because
	 * setup stopped its own scope and then threw. The outcome is settled and cannot change,
	 * so the error has nowhere to go; it is handed here instead of being swallowed.
	 * Defaults to `console.error`.
	 */
	readonly uncaughtSetupError?: (cause: unknown) => void;
};

export type ScopeOutcome = {
	// Why it ended
	readonly error?: unknown;
	readonly reason: 'stopped' | 'left' | 'failed';

	// Teardown
	readonly cleanupErrors: readonly unknown[];
};

export function createScope(options: ScopeOptions = {}): Scope {
	return createScopeNode(undefined, options);
}

function endScope(node: ScopeNode, reason: ScopeOutcome['reason'], error: unknown): void {
	if (node.isEnded) return;
	node.isEnded = true;
	node.tree.depth++;
	// notify the childScopes stop
	for (const child of [...node.childScopes]) endScope(child, 'stopped', undefined);
	node.childScopes.clear();
	// clean the childrens
	for (const fn of node.cleanups.reverse()) {
		try {
			fn();
		} catch (cause) {
			node.cleanupErrors.push(cause);
		}
	}
	node.tree.depth--;
	node.outcome = { reason, error, cleanupErrors: [...node.cleanupErrors] };
	node.ended?.(node.outcome);
	const parent = node.parent;
	//
	if (
		parent &&
		node.supervision === 'escalate' &&
		(error !== undefined || node.cleanupErrors.length)
	) {
		parent.addCleanupErrors(node.cleanupErrors);
		endScope(parent, 'failed', error);
	}
}

function createScopeNode(parent: ScopeNode | undefined, options: ScopeOptions): ScopeNode {
	const tree = parent?.tree ?? { depth: 0 };
	const node: ScopeNode = {
		fail: (error) => endScope(node, 'failed', error),
		leave: () => endScope(node, 'left', undefined),
		stop: () => endScope(node, 'stopped', undefined),

		addCleanupErrors: (errors) => {
			node.cleanupErrors.push(...errors);
		},
		onCleanup(fn) {
			if (node.isEnded) {
				fn();
				return;
			}
			node.cleanups.push(fn);
		},
		spawn: (o) => createScopeNode(node, o),

		isEnded: false,
		get isTransitioning() {
			// Determine if the entire tree is busy
			return tree.depth > 0;
		},
		outcome: undefined,

		childScopes: new Set(),
		parent,
		tree,

		cleanupErrors: [],
		cleanups: [],

		ended: options.ended,
		supervision: options.supervision ?? 'escalate',
		uncaughtSetupError: options.uncaughtSetupError ?? ((cause) => console.error(cause))
	};
	if (parent) {
		// A scope spawned on an ended parent is born ended and never runs its setup.
		if (parent.isEnded) {
			node.isEnded = true;
			node.outcome = { reason: 'stopped', cleanupErrors: [] };
			return node;
		}
		parent.childScopes.add(node);
	}
	if (options.setup) {
		tree.depth++;
		try {
			options.setup(node);
		} catch (error) {
			tree.depth--;
			if (node.isEnded) node.uncaughtSetupError(error);
			else endScope(node, 'failed', error);
			return node;
		}
		tree.depth--;
	}
	return node;
}
