import type { NormalizedHotChannelClient } from 'vite';
import type { RuntimeOpen, RuntimeSnapshot, TaskSnapshot } from './types';

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
