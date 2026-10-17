import type { NormalizedHotChannelClient } from 'vite';
import type {
	InjectionSnapshot,
	RuntimeInjection,
	RuntimeNotice,
	RuntimeOpen,
	RuntimeSnapshot,
	SerializedDiagnostic
} from './types';

const MAX_DIAGNOSTICS = 5;

type RuntimeState = {
	injections: Map<string, InjectionSnapshot>;
	diagnostics: SerializedDiagnostic[];
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
			injections: new Map(),
			diagnostics: []
		});
		this.onChange?.();
	}

	public updateInjection(client: NormalizedHotChannelClient, payload: RuntimeInjection): void {
		const runtime = this.clients.get(client)?.runtimes.get(payload.runtimeId);
		if (!runtime) return;
		runtime.injections.set(payload.injection.name, payload.injection);
		this.onChange?.();
	}

	public applyNotice(client: NormalizedHotChannelClient, payload: RuntimeNotice): void {
		const runtimes = this.clients.get(client)?.runtimes;
		const runtime = runtimes?.get(payload.runtimeId);
		if (!runtimes || !runtime) return;
		const { notice } = payload;
		// sync update injections table status
		switch (notice.type) {
			case 'injection-removed':
				runtime.injections.delete(notice.name);
				break;
			case 'diagnostic':
				runtime.diagnostics.push(notice);
				if (runtime.diagnostics.length > MAX_DIAGNOSTICS) runtime.diagnostics.shift();
				break;
			case 'instance-disposed':
				runtimes.delete(payload.runtimeId);
				break;
		}
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

	public getRuntimeSnapshots(): RuntimeSnapshot[] {
		return [...this.clients.values()].flatMap((clientState) =>
			[...clientState.runtimes.entries()].map(([runtimeId, state]) => ({
				clientId: clientState.clientId,
				runtimeId,
				injections: [...state.injections.values()],
				diagnostics: [...state.diagnostics]
			}))
		);
	}
}
