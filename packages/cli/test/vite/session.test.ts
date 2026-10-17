import type { NormalizedHotChannelClient } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { DevSession } from '../../src/session/DevSession';
import type { InjectionSnapshot, SerializedDiagnostic } from '../../src/session/types';

function createClient(): NormalizedHotChannelClient {
	return {} as NormalizedHotChannelClient;
}

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

function diagnostic(message: string): SerializedDiagnostic {
	return { type: 'diagnostic', error: { code: 'MAKOO_INSTANCE_OBSERVER_FAILED', message } };
}

describe('DevSession', () => {
	it('does not let an old unsubscribe detach the current subscriber', () => {
		const session = new DevSession();
		const oldListener = vi.fn();
		const stopOld = session.subscribe(oldListener);
		const listener = vi.fn();
		session.subscribe(listener);
		stopOld();
		session.open(createClient(), { runtimeId: 1 });
		expect(listener).toHaveBeenCalledOnce();
		expect(oldListener).not.toHaveBeenCalled();
	});
	it('drops state when the page disconnects', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.updateInjection(client, { runtimeId: 1, injection: panel });
		expect(session.getRuntimeSnapshots()).toEqual([
			{ clientId: 1, runtimeId: 1, injections: [panel], diagnostics: [] }
		]);

		session.disconnect(client);

		expect(session.isEmpty()).toBe(true);
		expect(session.getRuntimeSnapshots()).toEqual([]);
	});

	it('keeps client labels stable when another page disconnects', () => {
		const session = new DevSession();
		const firstClient = createClient();
		const secondClient = createClient();
		session.open(firstClient, { runtimeId: 1 });
		session.open(secondClient, { runtimeId: 1 });
		session.disconnect(firstClient);

		expect(session.getRuntimeSnapshots()[0]?.clientId).toBe(2);
	});

	it('notifies a subscriber when session state changes', () => {
		const session = new DevSession();
		const client = createClient();
		const onChange = vi.fn();
		const stop = session.subscribe(onChange);

		session.open(client, { runtimeId: 1 });
		session.updateInjection(client, { runtimeId: 1, injection: panel });
		session.applyNotice(client, { runtimeId: 1, notice: diagnostic('observer exploded') });
		expect(onChange).toHaveBeenCalledTimes(3);

		stop();
		session.disconnect(client);
		expect(onChange).toHaveBeenCalledTimes(3);
	});

	it('upserts Injection rows by name in first-seen order', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.updateInjection(client, { runtimeId: 1, injection: panel });
		session.updateInjection(client, { runtimeId: 1, injection: playClick });
		const failedPanel: InjectionSnapshot = {
			...panel,
			status: 'failed',
			lastError: { code: 'MAKOO_MOUNT_TARGET_DETACHED', message: 'Mount target detached' }
		};
		session.updateInjection(client, { runtimeId: 1, injection: failedPanel });

		expect(session.getRuntimeSnapshots()[0]?.injections).toEqual([failedPanel, playClick]);
	});

	it('removes only the named Injection subtree on injection-removed', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.updateInjection(client, { runtimeId: 1, injection: panel });
		session.updateInjection(client, { runtimeId: 1, injection: playClick });

		session.applyNotice(client, {
			runtimeId: 1,
			notice: { type: 'injection-removed', name: 'panel' }
		});

		expect(session.getRuntimeSnapshots()[0]?.injections).toEqual([playClick]);
	});

	it('keeps diagnostics apart from Injection phases and retains only the latest five', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.updateInjection(client, { runtimeId: 1, injection: playClick });
		for (let index = 1; index <= 6; index += 1) {
			session.applyNotice(client, { runtimeId: 1, notice: diagnostic(`failure ${index}`) });
		}

		const [runtime] = session.getRuntimeSnapshots();
		expect(runtime?.injections).toEqual([playClick]);
		expect(runtime?.diagnostics.map((notice) => notice.error.message)).toEqual([
			'failure 2',
			'failure 3',
			'failure 4',
			'failure 5',
			'failure 6'
		]);
	});

	it('closes a runtime on instance-disposed and ignores its later messages', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.updateInjection(client, { runtimeId: 1, injection: panel });
		session.applyNotice(client, { runtimeId: 1, notice: diagnostic('observer exploded') });
		session.open(client, { runtimeId: 2 });
		session.updateInjection(client, { runtimeId: 2, injection: playClick });

		session.applyNotice(client, { runtimeId: 1, notice: { type: 'instance-disposed' } });
		session.updateInjection(client, { runtimeId: 1, injection: panel });

		expect(session.getRuntimeSnapshots()).toEqual([
			{ clientId: 1, runtimeId: 2, injections: [playClick], diagnostics: [] }
		]);
	});

	it('ignores messages for a runtime it never opened', () => {
		const session = new DevSession();
		const client = createClient();
		const onChange = vi.fn();
		session.open(client, { runtimeId: 1 });
		session.subscribe(onChange);

		session.updateInjection(client, { runtimeId: 2, injection: panel });
		session.applyNotice(client, { runtimeId: 2, notice: diagnostic('stale') });
		session.updateInjection(createClient(), { runtimeId: 1, injection: panel });

		expect(session.getRuntimeSnapshots()).toEqual([
			{ clientId: 1, runtimeId: 1, injections: [], diagnostics: [] }
		]);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('ignores notices and disconnect for a client it never opened', () => {
		const session = new DevSession();
		const known = createClient();
		const unknown = createClient();
		const onChange = vi.fn();
		session.open(known, { runtimeId: 1 });
		session.subscribe(onChange);

		expect(() => {
			session.applyNotice(unknown, { runtimeId: 1, notice: diagnostic('stray') });
			session.disconnect(unknown);
		}).not.toThrow();

		expect(session.getRuntimeSnapshots()).toEqual([
			{ clientId: 1, runtimeId: 1, injections: [], diagnostics: [] }
		]);
		expect(onChange).not.toHaveBeenCalled();
	});
});
