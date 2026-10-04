import type { DOMObserver } from '../dom/observer';
import type { MakooError } from '../error/MakooError';
import { createState } from '../state/createState';
import { type ExecutionSlot, endExecution, type ListenerState } from './listener';
import type { ListenerStatus, MakooListenerDeclaration } from './types';

export type AttachListener = ListenerState & {
	readonly kind: 'attach';
	intent: 'running' | 'stopped';
	executionSlot: ExecutionSlot;
	readonly onFailed: (error: MakooError) => void;
};

export function createAttachListener(
	config: MakooListenerDeclaration,
	onFailed: (error: MakooError) => void,
	reportSubscriber: (cause: unknown) => void
): AttachListener {
	return {
		kind: 'attach',
		config,
		state: createState<ListenerStatus>('idle', reportSubscriber),
		intent: 'stopped',
		executionSlot: { kind: 'empty', cleanupPromise: Promise.resolve() },
		lastError: undefined,
		onFailed
	};
}

export async function stopAttachListeners(
	attachListeners: ReadonlyMap<string, AttachListener>,
	dom: DOMObserver
): Promise<MakooError[]> {
	// Invalidate every child before abort, unbinding, or notifications can reenter user code.
	for (const attachListener of attachListeners.values()) {
		attachListener.intent = 'stopped';
		const currentSlot = attachListener.executionSlot;
		if (currentSlot.kind === 'active') currentSlot.execution.phase = 'cancelled';
	}
	const errors: MakooError[] = [];
	for (const attachListener of attachListeners.values()) {
		const currentSlot = attachListener.executionSlot;
		switch (currentSlot.kind) {
			case 'empty':
				// Preserve a completed failure while stopping recovery between executions.
				if (attachListener.state.view.getSnapshot() !== 'failed')
					attachListener.state.set('idle');
				continue;
			case 'cleanup-failed':
				errors.push(...currentSlot.cleanupErrors);
				continue;
		}
		const { execution } = currentSlot;
		try {
			await endExecution(attachListener, dom, 'stopped');
		} catch {
			// Collect every cleanup error below, not just the rejected first error.
		}
		errors.push(...execution.cleanupErrors);
	}
	return errors;
}
