import type { NormalizedHotChannelClient } from 'vite';
import type { RuntimeEvent, RuntimeOpen, RuntimeSnapshot, TaskSnapshot } from './types';

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

	public record(client: NormalizedHotChannelClient, payload: RuntimeEvent): void {
		const clientState = this.clients.get(client);
		if (!clientState) return;

		const runtimeState = clientState.runtimes.get(payload.runtimeId);
		if (!runtimeState) return;

		const { event } = payload;

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
			// update task snapshot
			default: {
				if (!event.taskId) break;
				const task = runtimeState.tasks.get(event.taskId);
				if (!task) break;
				if (event.status) task.status = event.status;
				if (event.injectAt) task.injectAt = event.injectAt;
				break;
			}
		}
		// refresh the terminal when have a new update
		this.onChange?.();
	}

	public disconnect(client: NormalizedHotChannelClient): void {
		const clientState = this.clients.get(client);
		if (!clientState) return;

		this.clients.delete(client);
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
}
