import type { NormalizedHotChannelClient } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { DevSession } from '../../src/session/DevSession';

function createClient(): NormalizedHotChannelClient {
	return {} as NormalizedHotChannelClient;
}

describe('DevSession', () => {
	it('isolates identical task IDs across runtimes and browser clients', () => {
		const session = new DevSession();
		const first = createClient();
		const second = createClient();
		for (const [client, runtimeId] of [
			[first, 1],
			[first, 2],
			[second, 1]
		] as const) {
			session.open(client, { runtimeId });
			session.record(client, {
				runtimeId,
				event: {
					name: 'register:success',
					ts: 1,
					taskId: 'shared',
					kind: 'listener',
					status: 'idle',
					injectAt: 'window'
				}
			});
		}
		session.record(first, {
			runtimeId: 2,
			event: { name: 'task:statusChange', ts: 2, taskId: 'shared', status: 'active' }
		});
		expect(session.getTasks().map(({ tasks }) => tasks[0].status)).toEqual([
			'idle',
			'active',
			'idle'
		]);
		session.disconnect(first);
		expect(session.getTasks()).toMatchObject([
			{ clientId: 2, runtimeId: 1, tasks: [{ taskId: 'shared', status: 'idle' }] }
		]);
	});

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
	it('reduces registered task events into the current runtime snapshot', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });

		session.record(client, {
			runtimeId: 1,
			event: {
				name: 'register:success',
				ts: 1,
				taskId: 'task-1',
				kind: 'component',
				status: 'idle',
				injectAt: '#app',
				meta: { artifactName: 'Demo' }
			}
		});
		session.record(client, {
			runtimeId: 1,
			event: {
				name: 'task:statusChange',
				ts: 2,
				taskId: 'task-1',
				kind: 'component',
				status: 'active',
				preStatus: 'idle',
				injectAt: '#app',
				meta: { reason: 'target-found' }
			}
		});

		expect(session.getTasks()).toEqual([
			{
				clientId: 1,
				runtimeId: 1,
				tasks: [
					{
						taskId: 'task-1',
						kind: 'component',
						status: 'active',
						injectAt: '#app'
					}
				]
			}
		]);
	});

	it('removes destroyed tasks and drops state when the page disconnects', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.record(client, {
			runtimeId: 1,
			event: {
				name: 'register:success',
				ts: 1,
				taskId: 'task-1',
				kind: 'listener',
				status: 'idle',
				injectAt: 'window',
				meta: {}
			}
		});
		session.record(client, {
			runtimeId: 1,
			event: {
				name: 'task:afterDestroy',
				ts: 2,
				taskId: 'task-1',
				kind: 'listener',
				preStatus: 'idle',
				injectAt: 'window'
			}
		});

		expect(session.getTasks()[0]?.tasks).toEqual([]);

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

		session.record(client, {
			runtimeId: 1,
			event: { name: 'start:requested', ts: 1 }
		});
		expect(onChange).not.toHaveBeenCalled();

		session.open(client, { runtimeId: 1 });
		expect(onChange).toHaveBeenCalledTimes(1);
		session.record(client, {
			runtimeId: 99,
			event: { name: 'start:requested', ts: 2 }
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		session.record(client, {
			runtimeId: 1,
			event: { name: 'start:requested', ts: 2 }
		});
		expect(onChange).toHaveBeenCalledTimes(2);

		stop();
		session.disconnect(client);
		expect(onChange).toHaveBeenCalledTimes(2);
	});
});
