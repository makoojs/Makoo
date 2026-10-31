import { describe, expect, it, vi } from 'vitest';
import type { InjectionSnapshot, PageRuntimeRow } from '../../src/bridge/protocol';
import { RuntimeStore } from '../../src/bridge/store';

const panel: InjectionSnapshot = {
	name: 'panel',
	kind: 'component',
	status: 'mounted',
	attachedListeners: [{ name: 'hover', status: 'bound' }]
};
const playClick: InjectionSnapshot = {
	name: 'play-click',
	kind: 'standalone-listener',
	status: 'bound'
};

function row(runtimeId: number, injections: InjectionSnapshot[] = []): PageRuntimeRow {
	return { runtimeId, injections, diagnostics: [] };
}

describe('RuntimeStore', () => {
	it('projects each submitted row under its connection id', () => {
		const store = new RuntimeStore();
		store.replacePage(7, [row(1, [panel]), row(2, [playClick])]);

		expect(store.getRuntimeSnapshots()).toEqual([
			{ clientId: 7, runtimeId: 1, injections: [panel], diagnostics: [] },
			{ clientId: 7, runtimeId: 2, injections: [playClick], diagnostics: [] }
		]);
	});

	it('replaces a connection’s whole table rather than merging', () => {
		const store = new RuntimeStore();
		store.replacePage(1, [row(1, [panel, playClick])]);
		store.replacePage(1, [row(1, [playClick])]);

		expect(store.getRuntimeSnapshots()).toEqual([
			{ clientId: 1, runtimeId: 1, injections: [playClick], diagnostics: [] }
		]);
	});

	it('keeps connections isolated in submission order', () => {
		const store = new RuntimeStore();
		store.replacePage(1, [row(1, [panel])]);
		store.replacePage(2, [row(1, [playClick])]);
		store.disconnect(1);

		expect(store.getRuntimeSnapshots()).toEqual([
			{ clientId: 2, runtimeId: 1, injections: [playClick], diagnostics: [] }
		]);
	});

	it('notifies the subscriber on replace and on a real disconnect', () => {
		const store = new RuntimeStore();
		const onChange = vi.fn();
		store.subscribe(onChange);

		store.replacePage(1, [row(1)]);
		store.disconnect(9);
		expect(onChange).toHaveBeenCalledTimes(1);

		store.disconnect(1);
		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it('does not let an old unsubscribe detach the current subscriber', () => {
		const store = new RuntimeStore();
		const oldListener = vi.fn();
		const stopOld = store.subscribe(oldListener);
		const listener = vi.fn();
		store.subscribe(listener);
		stopOld();

		store.replacePage(1, [row(1)]);

		expect(listener).toHaveBeenCalledOnce();
		expect(oldListener).not.toHaveBeenCalled();
	});
});
