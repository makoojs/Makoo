import type { ObserveEvent } from '@makoojs/core';
import type { NormalizedHotChannelClient } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { DevSession } from '../../src/session/DevSession';

function createClient(): NormalizedHotChannelClient {
	return {} as NormalizedHotChannelClient;
}

function event(input: ObserveEvent): ObserveEvent {
	return input;
}

describe('DevSession', () => {
	it('reduces registered task events into the current runtime snapshot', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });

		session.record(client, {
			runtimeId: 1,
			event: event({
				name: 'register:success',
				ts: 1,
				taskId: 'task-1',
				kind: 'component',
				status: 'idle',
				injectAt: '#app',
				meta: { artifactName: 'Demo' }
			})
		});
		session.record(client, {
			runtimeId: 1,
			event: event({
				name: 'task:statusChange',
				ts: 2,
				taskId: 'task-1',
				kind: 'component',
				status: 'active',
				preStatus: 'idle',
				injectAt: '#app',
				meta: { reason: 'target-found' }
			})
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
		expect(session.getLogs().map((log) => log.event.name)).toEqual([
			'register:success',
			'task:statusChange'
		]);
		expect(session.getLogs()[0]?.event.meta).toEqual({ artifactName: 'Demo' });
	});

	it('removes destroyed tasks and drops state when the page disconnects', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });
		session.record(client, {
			runtimeId: 1,
			event: event({
				name: 'register:success',
				ts: 1,
				taskId: 'task-1',
				kind: 'listener',
				status: 'idle',
				injectAt: 'window',
				meta: {}
			})
		});
		session.record(client, {
			runtimeId: 1,
			event: event({
				name: 'task:afterDestroy',
				ts: 2,
				taskId: 'task-1',
				kind: 'listener',
				preStatus: 'idle',
				injectAt: 'window'
			})
		});

		expect(session.getTasks()[0]?.tasks).toEqual([]);
		expect(session.getLogs()).toHaveLength(2);

		session.disconnect(client);

		expect(session.isEmpty()).toBe(true);
		expect(session.getTasks()).toEqual([]);
		expect(session.getLogs()).toEqual([]);
	});

	it('keeps client labels stable when another page disconnects', () => {
		const session = new DevSession();
		const firstClient = createClient();
		const secondClient = createClient();
		session.open(firstClient, { runtimeId: 1 });
		session.open(secondClient, { runtimeId: 1 });
		session.disconnect(firstClient);

		session.record(secondClient, {
			runtimeId: 1,
			event: event({ name: 'start:requested', ts: 1 })
		});

		expect(session.getTasks()[0]?.clientId).toBe(2);
		expect(session.getLogs()[0]?.clientId).toBe(2);
	});

	it('records only events from an opened runtime', () => {
		const session = new DevSession();
		const client = createClient();

		expect(
			session.record(client, {
				runtimeId: 1,
				event: event({ name: 'start:requested', ts: 1 })
			})
		).toBeUndefined();
		session.open(client, { runtimeId: 1 });
		expect(
			session.record(client, {
				runtimeId: 1,
				event: event({ name: 'start:requested', ts: 2 })
			})
		).toEqual({
			clientId: 1,
			runtimeId: 1,
			event: { name: 'start:requested', ts: 2 }
		});
	});

	it('keeps only the latest 1000 log events', () => {
		const session = new DevSession();
		const client = createClient();
		session.open(client, { runtimeId: 1 });

		for (let ts = 1; ts <= 1001; ts += 1) {
			session.record(client, {
				runtimeId: 1,
				event: event({ name: 'start:requested', ts })
			});
		}

		expect(session.getLogs()).toHaveLength(1000);
		expect(session.getLogs()[0]?.event.ts).toBe(2);
		expect(session.getLogs()[999]?.event.ts).toBe(1001);
	});

	it('notifies a subscriber when session state changes', () => {
		const session = new DevSession();
		const client = createClient();
		const onChange = vi.fn();
		const stop = session.subscribe(onChange);

		session.record(client, {
			runtimeId: 1,
			event: event({ name: 'start:requested', ts: 1 })
		});
		expect(onChange).not.toHaveBeenCalled();

		session.open(client, { runtimeId: 1 });
		expect(onChange).toHaveBeenCalledTimes(1);
		session.record(client, {
			runtimeId: 1,
			event: event({ name: 'start:requested', ts: 2 })
		});
		expect(onChange).toHaveBeenCalledTimes(2);

		stop();
		session.disconnect(client);
		expect(onChange).toHaveBeenCalledTimes(2);
	});
});
