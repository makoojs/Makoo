import type { NormalizedHotChannelClient } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { DevSession } from '../../src/session/DevSession';

function createClient(): NormalizedHotChannelClient {
	return {} as NormalizedHotChannelClient;
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
		expect(session.getTasks()).toEqual([{ clientId: 1, runtimeId: 1, tasks: [] }]);

		session.disconnect(client);

		expect(session.isEmpty()).toBe(true);
		expect(session.getTasks()).toEqual([]);
	});

	it('keeps client labels stable when another page disconnects', () => {
		const session = new DevSession();
		const firstClient = createClient();
		const secondClient = createClient();
		session.open(firstClient, { runtimeId: 1 });
		session.open(secondClient, { runtimeId: 1 });
		session.disconnect(firstClient);

		expect(session.getTasks()[0]?.clientId).toBe(2);
	});

	it('notifies a subscriber when session state changes', () => {
		const session = new DevSession();
		const client = createClient();
		const onChange = vi.fn();
		const stop = session.subscribe(onChange);

		session.open(client, { runtimeId: 1 });
		expect(onChange).toHaveBeenCalledTimes(1);

		stop();
		session.disconnect(client);
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});
