import { coreErrors } from '../error/coreErrors';
import type { DOMObserver } from './observer';
import type { Scope, ScopeOutcome } from './scope';

// Options

export type AllMatchOptions = {
	// Mode
	mode: 'all';

	// Callbacks
	ended?(element: Element, outcome: ScopeOutcome): void;
};

export type FirstMatchOptions = {
	// Mode
	mode: 'first';

	// Waiting and reinjection
	reinject?: boolean;
	timeout?: number;

	// Error reporting
	detachedCode: 'MAKOO_MOUNT_TARGET_DETACHED' | 'MAKOO_LISTENER_TARGET_DETACHED';
	name: string;

	// Callbacks
	ended?(element: Element, outcome: ScopeOutcome): void;
};

export type MatchOptions = AllMatchOptions | FirstMatchOptions;

export const DEFAULT_MATCH_TIMEOUT = 15_000;

// Context

export type MatchContext = {
	// Reporting
	changed(): void;

	// Residue locks
	isLocked(element: Element): boolean;
	lock(element: Element): void;

	// Instance machinery
	observer: DOMObserver;
	operation<T>(run: () => T): T;
};

// Results

/** A mounted appearance: its own scope plus the DOM-only verb only `match` can offer. */
export type Appearance = Scope & {
	/** Excludes a container element (e.g. the component's own root) from future matching. */
	exclude(container: Element): void;
};

export type MatchHandle = {
	/** Live appearances (setup completed, scope still alive) in document order. */
	appearances(): readonly Element[];
};

/**
 * The only DOM lifecycle primitive. `match` keeps appearances alive while their element
 * stays connected and still matches: `first` mounts at most one (with wait timeout,
 * optional reinject after leave, escalate supervision); `all` collects every match
 * (isolate supervision). Cleanup failures always residue-lock the element.
 */
export function match(
	scope: Scope,
	selector: string,
	options: MatchOptions,
	context: MatchContext,
	setup: (element: Element, appearance: Appearance) => void
): MatchHandle {
	// Entry bookkeeping
	const entries = new Map<Element, Scope | 'failed'>();
	const excludedContainers = new Set<Element>();
	let lockedSkipCount = 0;
	const stoppedElements = new WeakSet<Element>();

	// Subscription and timer
	const observerAbort = new AbortController();
	let waitTimer: ReturnType<typeof setTimeout> | undefined;

	// Entry queries
	const hasLiveAppearance = () => {
		for (const entry of entries.values()) if (isLiveEntry(entry)) return true;
		return false;
	};

	const isInsideExcludedContainer = (element: Element) => {
		for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement)
			if (excludedContainers.has(ancestor)) return true;
		return false;
	};

	const isLiveEntry = (entry: Scope | 'failed') => entry !== 'failed' && !entry.isEnded;

	// Matching
	const scan = () => {
		if (scope.isEnded) return;
		// Leave detection: live or failed entries settle once their element leaves the DOM (leave can synchronously trigger a reinject scan)
		for (const [element, entry] of [...entries]) {
			if (element.isConnected) continue;
			if (entry === 'failed') entries.delete(element);
			else entry.leave();
		}
		lockedSkipCount = 0;
		if (options.mode !== 'first' || !hasLiveAppearance()) {
			for (const element of document.querySelectorAll(selector)) {
				if (scope.isEnded) return;
				if (
					entries.has(element) ||
					stoppedElements.has(element) ||
					isInsideExcludedContainer(element)
				)
					continue;
				if (context.isLocked(element)) {
					lockedSkipCount++;
					continue;
				}
				spawnAppearance(element);
				if (options.mode === 'first' && hasLiveAppearance()) break;
			}
		}
		refreshWaitTimer();
	};

	const spawnAppearance = (element: Element) => {
		const appearanceScope = scope.spawn({
			setup: (spawnedScope) => {
				const appearance = spawnedScope as Appearance;
				appearance.exclude = (container: Element) => {
					excludedContainers.add(container);
					appearance.onCleanup(() => excludedContainers.delete(container));
				};
				setup(element, appearance);
			},
			supervision: options.mode === 'all' ? 'isolate' : 'escalate',

			ended: (outcome) => onAppearanceEnded(element, outcome)
		});
		if (appearanceScope.isEnded) return; // born ended or setup failed — the ended callback (if any) already settled it
		entries.set(element, appearanceScope);
		context.changed();
	};

	// Appearance end
	const onAppearanceEnded = (element: Element, outcome: ScopeOutcome) => {
		if (options.mode === 'all' && outcome.reason === 'failed') entries.set(element, 'failed');
		else entries.delete(element);
		// `stoppedElements` covers a child's own stop(); the whole WeakSet dies with this match instance,
		// so group teardown adding entries is harmless.
		if (options.mode === 'all' && outcome.reason === 'stopped') stoppedElements.add(element);
		if (outcome.cleanupErrors.length) {
			context.lock(element);
			// Under isolate, per-child failures are not merged into the host; only child cleanup errors that arrive while the host is mid-teardown join the group aggregate
			if (options.mode === 'all' && scope.isEnded)
				scope.addCleanupErrors(outcome.cleanupErrors);
		}
		options.ended?.(element, outcome);
		context.changed();
		if (
			options.mode === 'first' &&
			outcome.reason === 'left' &&
			!outcome.cleanupErrors.length &&
			!scope.isEnded
		) {
			if (options.reinject) scan();
			else
				scope.fail(coreErrors.createRecorded(options.detachedCode, { name: options.name }));
		}
	};

	// Wait timer
	const refreshWaitTimer = () => {
		if (options.mode !== 'first') return;
		if (hasLiveAppearance() || scope.isEnded) {
			clearTimeout(waitTimer);
			waitTimer = undefined;
			return;
		}
		// The clock runs in wait rounds: it arms only when a wait begins; scans during a wait do not reset it
		if (waitTimer !== undefined) return;
		const timeout = options.timeout ?? DEFAULT_MATCH_TIMEOUT;
		waitTimer = setTimeout(() => {
			waitTimer = undefined;
			context.operation(() => {
				if (scope.isEnded || hasLiveAppearance()) return;
				scope.fail(
					coreErrors.createRecorded('MAKOO_TARGET_WAIT_TIMEOUT', {
						name: options.name,
						selector,
						timeout,
						...(lockedSkipCount ? { lockedSkipped: lockedSkipCount } : {})
					})
				);
			});
		}, timeout);
	};

	// Start
	scope.onCleanup(() => {
		observerAbort.abort();
		clearTimeout(waitTimer);
	});
	context.observer.subscribe(scan, observerAbort.signal);
	scan();

	return {
		appearances() {
			const elements: Element[] = [];
			for (const [element, entry] of entries) if (isLiveEntry(entry)) elements.push(element);
			return elements.sort((a, b) =>
				a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
			);
		}
	};
}
