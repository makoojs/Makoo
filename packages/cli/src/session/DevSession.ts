import type { NormalizedHotChannelClient } from 'vite';
import type {
	RuntimeEvent,
	RuntimeLog,
	RuntimeOpen,
	RuntimeSnapshot,
	TaskSnapshot
} from './types';

const MAX_LOGS = 1000;

type RuntimeState = {
	tasks: Map<string, TaskSnapshot>;
};

type ClientState = {
	clientId: number;
	runtimes: Map<number, RuntimeState>;
};

export class DevSession {
	private readonly clients = new Map<NormalizedHotChannelClient, ClientState>();
	private nextClientId = 1;
	private logs: RuntimeLog[] = [];
	private onChange: (() => void) | null = null;

	public subscribe(onChange: () => void): () => void {
		this.onChange = onChange;
		return () => {
			if (this.onChange === onChange) this.onChange = null;
		};
	}

	public open(client: NormalizedHotChannelClient, payload: RuntimeOpen): void {
		let clientState = this.clients.get(client);
		if (!clientState) {
			clientState = { clientId: this.nextClientId, runtimes: new Map() };
			this.nextClientId += 1;
			this.clients.set(client, clientState);
		}

		clientState.runtimes.set(payload.runtimeId, {
			tasks: new Map()
		});
		this.onChange?.();
	}

	public record(
		client: NormalizedHotChannelClient,
		payload: RuntimeEvent
	): RuntimeLog | undefined {
		const clientState = this.clients.get(client);
		if (!clientState) return;

		const runtimeState = clientState.runtimes.get(payload.runtimeId);
		if (!runtimeState) return;

		const { event } = payload;
		const log = {
			clientId: clientState.clientId,
			runtimeId: payload.runtimeId,
			event
		};
		this.logs.push(log);
		if (this.logs.length > MAX_LOGS) this.logs.shift();

		switch (event.name) {
			case 'task:afterDestroy':
				if (event.taskId) runtimeState.tasks.delete(event.taskId);
				break;
			case 'register:success':
				if (event.taskId && event.kind && event.status && event.injectAt) {
					runtimeState.tasks.set(event.taskId, {
						taskId: event.taskId,
						kind: event.kind,
						status: event.status,
						injectAt: event.injectAt
					});
				}
				break;
			default: {
				if (!event.taskId) break;
				const task = runtimeState.tasks.get(event.taskId);
				if (!task) break;
				if (event.status) task.status = event.status;
				if (event.injectAt) task.injectAt = event.injectAt;
				break;
			}
		}

		this.onChange?.();
		return log;
	}

	public disconnect(client: NormalizedHotChannelClient): void {
		const clientState = this.clients.get(client);
		if (!clientState) return;

		this.clients.delete(client);
		this.logs = this.logs.filter((log) => log.clientId !== clientState.clientId);
		this.onChange?.();
	}

	public isEmpty(): boolean {
		return this.clients.size === 0;
	}

	public getTasks(): RuntimeSnapshot[] {
		return [...this.clients.values()].flatMap((clientState) =>
			[...clientState.runtimes.entries()].map(([runtimeId, state]) => ({
				clientId: clientState.clientId,
				runtimeId,
				tasks: [...state.tasks.values()]
			}))
		);
	}

	public getLogs(): RuntimeLog[] {
		return this.logs;
	}
}
